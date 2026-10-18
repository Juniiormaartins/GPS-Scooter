import { inheritsRegime, REGIME_REACH_METERS, roadKey, type RoadRegime } from '@/services/routing/roadKey'
import { haversineDistanceMeters } from '@/utils/geo'
import { mobilityProfile, wayTiersFor, type SuitabilityReasonCode } from '@/config/mobilityProfiles'
import type { VehicleModelId } from '@/config/userPreferences'
import type { Eligibility, RouteSegment, SuitabilityTier, WayKind } from '@/types/routing'

/**
 * Classificação de vias POR PERFIL DE MOBILIDADE.
 *
 * O QUE MUDOU E POR QUÊ. Antes existia uma tabela única de adequação
 * (`TIER_BY_ROAD_CLASS`) aplicada aos três veículos, com dois ajustes a
 * posteriori. Isso fazia bicicleta elétrica e scooter lerem uma
 * avenida arterial exatamente da mesma forma — e nenhum dos três reconhecia
 * ciclovia, calçada, calçadão ou escada, porque esses tipos de via nem
 * chegavam à classificação.
 *
 * Agora a tabela vem do perfil do veículo (config/mobilityProfiles.ts). O
 * classificador não conhece veículo nenhum: ele lê a tabela do perfil ativo.
 * Acrescentar um quarto veículo é acrescentar um perfil, não um `if`.
 *
 * Prioridade dos sinais, do mais para o menos confiável:
 * 1. tags reais do OSM (access, motorroad, ref, maxspeed, bicycle, foot);
 * 2. tipo de via normalizado (`wayKind`) contra a tabela do perfil;
 * 3. `RoadClass` do provedor, quando não houve enriquecimento;
 * 4. heurística por nome — último recurso, nunca fonte de verdade.
 *
 * CADA RESULTADO CARREGA UM MOTIVO. Um indicador vermelho sem explicação
 * obriga o usuário a adivinhar; o motivo viaja junto com o nível até a
 * interface.
 */

export interface SegmentAssessment {
  tier: SuitabilityTier
  reason: SuitabilityReasonCode
}

const HIGHWAY_REF_PATTERN = /^BR-?\d{2,3}$/i
const HIGHWAY_NAME_PATTERN = /\bBR-?\d{2,3}\b|\brodovia\b|\bvia\s+expressa\b|\banel\s+vi[aá]rio\b/i
const ARTERIAL_NAME_PATTERN = /\bavenida\b|\bav\.\b/i

/** Contexto do veículo. Opcional: sem ele a leitura é estrutural, sem perfil. */
export interface VehicleClassificationContext {
  modelId: VehicleModelId
  referenceSpeedKmh: number
  /**
   * Regime de cada via (por nome), revelado por TODAS as candidatas da viagem —
   * ver `roadRegimes.ts`. Ausente = cada trecho vale só pela sua própria tag.
   */
  regimes?: ReadonlyMap<string, RoadRegime>
}

/**
 * Normaliza o valor bruto de `highway=` do OSM para o vocabulário do projeto.
 *
 * `_link` some (uma alça de acesso à primária é uma primária), e os tipos que
 * não interessam ao roteamento de superfície caem em `unknown` — onde a
 * tabela do perfil tem um valor neutro, em vez de um chute.
 */
export function normalizeWayKind(highway: string | undefined): WayKind {
  if (!highway) return 'unknown'
  const value = highway.trim().toLowerCase().replace(/_link$/, '')
  switch (value) {
    case 'motorway':
    case 'trunk':
    case 'primary':
    case 'secondary':
    case 'tertiary':
    case 'residential':
    case 'living_street':
    case 'service':
    case 'cycleway':
    case 'footway':
    case 'pedestrian':
    case 'path':
    case 'track':
    case 'steps':
      return value
    // `unclassified` no OSM não significa "sem classificação": é uma via
    // pública de menor hierarquia, equivalente na prática a uma residencial.
    case 'unclassified':
      return 'residential'
    case 'bridleway':
      return 'path'
    case 'corridor':
      return 'footway'
    default:
      return 'unknown'
  }
}

/** Compatibilidade: quem só precisa do nível continua chamando isto. */
export function classifySegment(segment: RouteSegment, vehicle?: VehicleClassificationContext): SuitabilityTier {
  return assessSegment(segment, vehicle).tier
}

export function assessSegment(segment: RouteSegment, vehicle?: VehicleClassificationContext): SegmentAssessment {
  const base = assessStructurally(segment, vehicle)
  const avaliado = vehicle ? applyVehicleAdjustment(base, segment, vehicle) : base
  return applyRoadRegime(avaliado, segment, vehicle)
}

/**
 * A via inteira vale o que ela é na maior parte (ver `roadRegimes.ts`).
 *
 * Só PIORA: um trecho já inadequado ou proibido fica como está, e um trecho de
 * ciclovia/calçada nunca herda regime de via motorizada. O efeito é que a mesma
 * avenida deixa de ser "adequada" numa rota e "atenção" noutra por causa de um
 * pedaço de 150 m que o OSM etiquetou diferente.
 */
function applyRoadRegime(
  avaliado: SegmentAssessment,
  segment: RouteSegment,
  vehicle?: VehicleClassificationContext,
): SegmentAssessment {
  if (!vehicle?.regimes || avaliado.tier === 'unsuitable' || avaliado.tier === 'prohibited') return avaliado
  if (!inheritsRegime(segment)) return avaliado
  const chave = roadKey(segment)
  const regime = chave ? vehicle.regimes.get(chave) : undefined
  if (!regime) return avaliado
  // Só perto de onde a via foi observada inadequada (ver `RoadRegime.anchors`).
  const meio = segment.path[Math.floor(segment.path.length / 2)] ?? segment.path[0]
  if (!meio) return avaliado
  const perto = regime.anchors.some((ancora) => haversineDistanceMeters(ancora, meio) <= REGIME_REACH_METERS)
  return perto ? { tier: regime.tier, reason: regime.reason } : avaliado
}

function assessStructurally(segment: RouteSegment, vehicle?: VehicleClassificationContext): SegmentAssessment {
  const tags = segment.osmTags

  // Sinais explícitos do OSM vêm antes de qualquer tabela.
  if (tags?.access && /^(no|private)$/i.test(tags.access.trim())) {
    return { tier: 'prohibited', reason: 'access-restricted' }
  }

  const wayKind = segment.wayKind ?? normalizeWayKind(tags?.highway)

  // Escada é impossível de percorrer sobre qualquer um dos veículos. Isto não
  // é regra legal inventada — é geometria.
  if (wayKind === 'steps') return { tier: 'prohibited', reason: 'not-rideable' }

  const profile = vehicle ? mobilityProfile(vehicle.modelId) : null

  /**
   * `bicycle=no` deixou de ser proibição UNIVERSAL.
   *
   * Era: qualquer via com `bicycle=no` virava `prohibited` para os três
   * veículos. Mas a tag fala de bicicleta — numa via onde bicicleta é
   * proibida e scooter motorizada é o tráfego normal, ela dizia o contrário
   * do que vale. Agora ela só proíbe quem, de fato, circula como bicicleta.
   */
  const bicycleNo = tags?.bicycle != null && /^no$/i.test(tags.bicycle.trim())
  const ridesAsBicycle = profile?.costing === 'bicycle'
  if (bicycleNo && (ridesAsBicycle || !profile)) {
    return { tier: 'prohibited', reason: 'access-restricted' }
  }

  // Túnel / passagem em desnível numa via de tráfego rápido (ver `isUnderpass`).
  if (isUnderpass(tags) && underpassIsSerious(wayKind, tags)) {
    return { tier: 'unsuitable', reason: 'tunnel-underpass' }
  }

  // Infraestrutura designada: melhor caso para quem ela serve.
  const designatedForBicycle = tags?.bicycle != null && /^(yes|designated)$/i.test(tags.bicycle.trim())
  if (designatedForBicycle && (!profile || ridesAsBicycle)) {
    return { tier: 'very-good', reason: 'ideal-infrastructure' }
  }

  if (tags?.motorroad && /^yes$/i.test(tags.motorroad.trim())) {
    return { tier: 'unsuitable', reason: 'expressway' }
  }
  if (tags?.ref && HIGHWAY_REF_PATTERN.test(tags.ref.trim())) {
    return { tier: 'unsuitable', reason: 'expressway' }
  }

  if (profile && vehicle && wayKind !== 'unknown') {
    const tier = wayTiersFor(vehicle.modelId, vehicle.referenceSpeedKmh)[wayKind]
    return { tier, reason: reasonForWayKind(wayKind, tier) }
  }

  // Sem enriquecimento: usa o que o provedor deu.
  if (segment.roadClass !== 'unknown') {
    const fromClass = normalizeWayKind(segment.roadClass)
    if (profile && vehicle) {
      const tier = wayTiersFor(vehicle.modelId, vehicle.referenceSpeedKmh)[fromClass]
      return { tier, reason: reasonForWayKind(fromClass, tier) }
    }
  }

  // Último recurso: nome da via.
  if (segment.roadName && HIGHWAY_NAME_PATTERN.test(segment.roadName)) {
    return { tier: 'unsuitable', reason: 'expressway' }
  }
  if (segment.roadName && ARTERIAL_NAME_PATTERN.test(segment.roadName)) {
    return { tier: 'good', reason: 'urban-road' }
  }
  return { tier: 'good', reason: 'no-data' }
}

/**
 * TÚNEL E PASSAGEM EM DESNÍVEL.
 *
 * Caso real, relatado na rua: o Waze mandou a scooter (32 km/h) por uma
 * passagem em desnível — desce, passa por baixo e sobe — numa avenida onde os
 * carros andam muito mais rápido. Dentro dela não há acostamento, não dá para
 * sair do caminho dos outros, e a subida de saída tira a força de um motor
 * pequeno justamente quando a velocidade já é baixa. É um dos piores lugares
 * para este veículo, e nada na classificação por tipo de via o enxergava: a via
 * é uma `primary`/`secondary` comum, só que por baixo.
 *
 * COMO O OSM MARCA: `tunnel=yes` na maioria dos casos; às vezes só `layer=-1`.
 * Fora da conta: `building_passage` (passagem por dentro de prédio) e `culvert`
 * (bueiro, não é via), e `tunnel=no` explícito. `bridge` junto com `layer`
 * negativo é dado inconsistente — na dúvida, não afirma túnel.
 */
export function isUnderpass(tags: RouteSegment['osmTags']): boolean {
  if (!tags) return false
  const tunnel = tags.tunnel?.trim().toLowerCase()
  if (tunnel === 'no') return false
  if (tunnel && tunnel !== 'building_passage' && tunnel !== 'culvert') return true
  if (tags.bridge && !/^no$/i.test(tags.bridge.trim())) return false
  const layer = Number.parseInt(tags.layer ?? '', 10)
  return Number.isFinite(layer) && layer < 0
}

/** Só pesa onde há tráfego rápido: um túnel de pedestre ou uma travessa sob a linha do trem não é o problema. */
function underpassIsSerious(wayKind: WayKind, tags: RouteSegment['osmTags']): boolean {
  if (wayKind === 'trunk' || wayKind === 'primary' || wayKind === 'secondary') return true
  if (wayKind === 'tertiary') {
    const maxSpeed = tags?.maxspeed ? Number.parseInt(tags.maxspeed, 10) : NaN
    return Number.isFinite(maxSpeed) && maxSpeed >= 50
  }
  return false
}

function reasonForWayKind(kind: WayKind, tier: SuitabilityTier): SuitabilityReasonCode {
  // O motivo tem de concordar com o nível. Antes devolvia sempre "infraestrutura
  // própria", então uma ciclovia vermelha para a scooter explicava a si mesma
  // como se fosse o melhor caso.
  if (kind === 'cycleway') return tier === 'very-good' || tier === 'good' ? 'ideal-infrastructure' : 'bicycle-only-infrastructure'
  // Proibido (veículo motorizado em calçada/passarela/caminho) tem motivo próprio:
  // "circule devagar e dê preferência" descreveria um trecho que o app não recomenda.
  if ((kind === 'footway' || kind === 'pedestrian' || kind === 'path') && tier === 'prohibited') return 'pedestrian-only'
  if (kind === 'footway' || kind === 'pedestrian') return 'pedestrian-space'
  // Só via de acesso limitado é "rodovia". Uma arterial urbana ruim para o
  // veículo é outra coisa, e descrevê-la como rodovia faria a explicação não
  // bater com o que o usuário vê na rua.
  if (kind === 'motorway' || kind === 'trunk') return 'expressway'
  if (kind === 'residential' || kind === 'living_street') return 'local-street'
  if (kind === 'path' || kind === 'track') return 'loose-surface'
  if (tier === 'unsuitable') return 'arterial-road'
  if (tier === 'caution') return 'shared-with-traffic'
  return 'urban-road'
}

/**
 * Ajuste ao veículo, sobre a leitura estrutural.
 *
 * O QUE ELE **NÃO** FAZ, deliberadamente:
 * - nunca transforma `prohibited` em utilizável;
 * - nunca inventa restrição legal — tudo aqui é adequação, que é o eixo de
 *   qualidade, separado do eixo de elegibilidade;
 * - só age com DADO REAL: sem `maxspeed` não há diferencial para calcular,
 *   sem `surface` não há piso para avaliar.
 */
function applyVehicleAdjustment(
  base: SegmentAssessment,
  segment: RouteSegment,
  vehicle: VehicleClassificationContext,
): SegmentAssessment {
  if (base.tier === 'prohibited') return base

  const profile = mobilityProfile(vehicle.modelId)
  let { tier, reason } = base
  const tags = segment.osmTags

  const onOwnInfrastructure = base.reason === 'ideal-infrastructure'

  const maxSpeed = tags?.maxspeed ? Number.parseInt(tags.maxspeed, 10) : undefined
  const avenida = refineArterialForScooter(base, segment, vehicle)
  if (avenida) {
    // Avenida: a velocidade permitida decide, e ela nunca vira vermelho sozinha (ver a função).
    tier = avenida.tier
    reason = avenida.reason
  } else if (!onOwnInfrastructure && maxSpeed && Number.isFinite(maxSpeed)) {
    const differential = maxSpeed - vehicle.referenceSpeedKmh
    if (differential >= profile.speedDifferentialThresholdKmh) {
      tier = downgrade(tier as NonProhibitedTier)
      reason = 'high-speed-traffic'
    }
  }

  if (profile.looseSurfaceSensitivity !== 'low' && isLooseSurface(tags?.surface)) {
    // 'high' (roda pequena) desce sempre; 'medium' só desce se o trecho já
    // não era ideal, para não rebaixar uma rua local de piso compactado.
    if (profile.looseSurfaceSensitivity === 'high' || tier !== 'very-good') {
      tier = downgrade(tier as NonProhibitedTier)
      reason = 'loose-surface'
    }
  }

  return { tier, reason }
}

/**
 * AVENIDAS (primary/secondary) PARA A SCOOTER: atenção, não perigo.
 *
 * Quem pilota explicou o critério: numa cidade sem ciclovia a avenida muitas
 * vezes é o único caminho, então pintá-la de vermelho não ajuda — vermelho é para
 * o que é crítico de verdade (BR, rodovia, túnel). O que a avenida pede é um
 * ponto de atenção, e o quanto depende da VELOCIDADE PERMITIDA nela: andar a
 * 32 km/h numa via de 40 ou 50 é tranquilo, mesmo com carros mais rápidos.
 *
 * Pela diferença entre o limite da via e a velocidade do veículo:
 *   até 18 km/h (via de até 50 p/ 32)  → boa
 *   de 19 a 47 km/h                    → atenção (âmbar), nunca vermelho
 *   48 km/h ou mais (via de 80 ou +)   → desaconselhada: já é perfil de rodovia
 *
 * Sem `maxspeed` no OSM não há velocidade para ler, e a tabela por tipo de via
 * segue valendo — só uma avenida secundária de 4 faixas ou mais passa de boa a
 * atenção, porque é o que "avenida movimentada" quer dizer nos dados.
 *
 * Só para a scooter (costing `motor_scooter`) e só onde a leitura anterior era
 * por tipo de via: expressa, túnel e acesso restrito têm regra própria e não
 * passam por aqui.
 */
const AVENUE_COMFORT_GAP_KMH = 18
const AVENUE_CRITICAL_GAP_KMH = 48
const AVENUE_HIGH_SPEED_NOTE_GAP_KMH = 28
const BUSY_AVENUE_MIN_LANES = 4

function refineArterialForScooter(
  base: SegmentAssessment,
  segment: RouteSegment,
  vehicle: VehicleClassificationContext,
): { tier: NonProhibitedTier; reason: SuitabilityReasonCode } | null {
  if (mobilityProfile(vehicle.modelId).costing !== 'motor_scooter') return null
  if (base.reason !== 'urban-road' && base.reason !== 'shared-with-traffic' && base.reason !== 'arterial-road') return null

  const tags = segment.osmTags
  const wayKind = segment.wayKind ?? normalizeWayKind(tags?.highway)
  if (wayKind !== 'primary' && wayKind !== 'secondary') return null

  const maxSpeed = tags?.maxspeed ? Number.parseInt(tags.maxspeed, 10) : NaN
  if (Number.isFinite(maxSpeed) && maxSpeed > 0) {
    const gap = maxSpeed - vehicle.referenceSpeedKmh
    if (gap <= AVENUE_COMFORT_GAP_KMH) return { tier: 'good', reason: 'urban-road' }
    if (gap >= AVENUE_CRITICAL_GAP_KMH) return { tier: 'unsuitable', reason: 'high-speed-traffic' }
    return { tier: 'caution', reason: gap >= AVENUE_HIGH_SPEED_NOTE_GAP_KMH ? 'high-speed-traffic' : 'shared-with-traffic' }
  }

  const lanes = Number.parseInt(tags?.lanes ?? '', 10)
  if (wayKind === 'secondary' && Number.isFinite(lanes) && lanes >= BUSY_AVENUE_MIN_LANES) {
    return { tier: 'caution', reason: 'shared-with-traffic' }
  }
  return null
}

type NonProhibitedTier = Exclude<SuitabilityTier, 'prohibited'>

/** Desce exatamente um degrau, sem nunca chegar a 'prohibited' — proibição não se infere. */
function downgrade(tier: NonProhibitedTier): NonProhibitedTier {
  switch (tier) {
    case 'very-good':
      return 'good'
    case 'good':
      return 'caution'
    case 'caution':
      return 'unsuitable'
    default:
      return tier
  }
}

/**
 * Piso solto — subconjunto do que `avoidances.isUnpavedSurface` considera não
 * pavimentado. Aqui a lista é mais estreita: `compacted` é não pavimentado,
 * mas é firme e não desestabiliza como cascalho ou areia.
 */
const LOOSE_SURFACES = new Set(['gravel', 'fine_gravel', 'dirt', 'earth', 'ground', 'sand', 'mud', 'pebblestone'])

function isLooseSurface(surface: string | undefined): boolean {
  if (!surface) return false
  return surface
    .toLowerCase()
    .split(';')
    .some((value) => LOOSE_SURFACES.has(value.trim()))
}

/** Penalidade em pontos por km percorrido naquele nível — não é uma proibição binária. */
export const TIER_PENALTY_PER_KM: Record<SuitabilityTier, number> = {
  'very-good': 0,
  good: 0,
  caution: 6,
  unsuitable: 14,
  prohibited: 100,
}

/**
 * Elegibilidade é um eixo separado da pontuação. 'unsuitable' continua
 * ELEGÍVEL ('discouraged') — o produto desaconselha via expressa por
 * qualidade, mas não afirma que seja proibida sem sinal explícito do OSM.
 * É isso que mantém a rota perigosa VISÍVEL como alternativa em vez de
 * desaparecer da interface.
 */
export const TIER_ELIGIBILITY: Record<SuitabilityTier, Eligibility> = {
  'very-good': 'allowed',
  good: 'allowed',
  caution: 'allowed',
  unsuitable: 'discouraged',
  prohibited: 'not-allowed',
}

export const TIER_LABEL: Record<SuitabilityTier, string> = {
  'very-good': 'vias adequadas ao veículo',
  good: 'vias urbanas comuns',
  caution: 'trechos que exigem atenção',
  unsuitable: 'vias fortemente desaconselhadas',
  prohibited: 'trechos não utilizáveis',
}
