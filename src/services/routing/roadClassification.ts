import type { VehicleModelId } from '@/config/userPreferences'
import type { Eligibility, RoadClass, RouteSegment, SuitabilityTier } from '@/types/routing'

/**
 * Camada de classificação de vias ("scooter suitability"): traduz a
 * classificação estrutural de uma via (RoadClass + tags do OSM, quando o
 * enriquecimento via Overpass encontrou correspondência) em um nível de
 * adequação ao perfil autopropelido. Não decide pontuação nem faz
 * agregações de rota — isso é responsabilidade do ruleEngine.
 *
 * Prioridade dos sinais, do mais para o menos confiável:
 * 1. tags reais do OSM (segment.osmTags) — access, motorroad, ref, maxspeed;
 * 2. RoadClass estrutural (preenchido pelo enriquecimento ou, na ausência
 *    dele, diretamente pelo provedor de rota);
 * 3. heurística temporária por nome da via — só usada quando nenhuma
 *    informação estruturada está disponível (provedor sem dados + Overpass
 *    sem match). Não deve ser tratada como fonte de verdade.
 *
 * A partir da classificação estrutural, um ajuste POR VEÍCULO é aplicado (ver
 * `applyVehicleAdjustment`). A via é a mesma; o que muda é o quanto ela serve
 * para quem está em cima dela.
 */

/**
 * Diferença de velocidade, em km/h, a partir da qual conviver com o tráfego
 * deixa de ser confortável e a via cai um nível.
 *
 * O sinal aqui é o DIFERENCIAL, não a velocidade absoluta da via: o risco de
 * um veículo lento em tráfego misto vem de ser ultrapassado repetidamente,
 * e isso depende de quanto mais rápido o resto anda. Uma avenida de 60 km/h
 * é uma situação diferente para uma scooter de 32 km/h (28 de diferença) e
 * para um patinete de 25 (35 de diferença) — é exatamente esse tipo de
 * distinção que o usuário espera ao trocar de veículo no perfil.
 *
 * 30 km/h é onde colocamos a linha: abaixo disso o fluxo ainda absorve o
 * veículo lento; acima, ele vira obstáculo. É um limiar de produto, não uma
 * medição de campo, e está documentado como tal.
 */
const SPEED_DIFFERENTIAL_THRESHOLD_KMH = 30

/**
 * Sensibilidade a piso solto por veículo. Roda pequena de patinete perde
 * estabilidade em cascalho e terra de um jeito que aro de bicicleta não
 * perde — a condição detectada é a mesma, a consequência não.
 */
const LOOSE_SURFACE_SENSITIVITY: Record<VehicleModelId, 'high' | 'medium' | 'low'> = {
  'scooter-25': 'high',
  'scooter-32': 'medium',
  'ebike-25': 'low',
  custom: 'medium',
}

const TIER_BY_ROAD_CLASS: Record<Exclude<RoadClass, 'unknown'>, SuitabilityTier> = {
  residential: 'very-good',
  service: 'very-good',
  tertiary: 'good',
  secondary: 'good',
  primary: 'caution',
  trunk: 'unsuitable',
  motorway: 'unsuitable',
}

const HIGHWAY_REF_PATTERN = /^BR-?\d{2,3}$/i
const HIGHWAY_NAME_PATTERN = /\bBR-?\d{2,3}\b|\brodovia\b|\bvia\s+expressa\b|\banel\s+vi[aá]rio\b/i
const ARTERIAL_NAME_PATTERN = /\bavenida\b|\bav\.\b/i

/**
 * Contexto do veículo para a classificação. Fica opcional de propósito: sem
 * ele a função devolve a classificação estrutural pura, que é o
 * comportamento anterior — nenhum chamador quebra por não passar o veículo.
 */
export interface VehicleClassificationContext {
  modelId: VehicleModelId
  referenceSpeedKmh: number
}

export function classifySegment(segment: RouteSegment, vehicle?: VehicleClassificationContext): SuitabilityTier {
  const base = classifySegmentStructurally(segment)
  return vehicle ? applyVehicleAdjustment(base, segment, vehicle) : base
}

function classifySegmentStructurally(segment: RouteSegment): SuitabilityTier {
  const tags = segment.osmTags

  // Sinais fortes e explícitos do OSM têm prioridade sobre qualquer heurística.
  if (tags?.access && /^(no|private)$/i.test(tags.access.trim())) {
    return 'prohibited'
  }
  if (tags?.bicycle && /^no$/i.test(tags.bicycle.trim())) {
    return 'prohibited'
  }
  if (tags?.motorroad && /^yes$/i.test(tags.motorroad.trim())) {
    return 'unsuitable'
  }
  if (tags?.ref && HIGHWAY_REF_PATTERN.test(tags.ref.trim())) {
    return 'unsuitable'
  }
  if (tags?.bicycle && /^(yes|designated)$/i.test(tags.bicycle.trim())) {
    return 'very-good'
  }

  if (segment.roadClass !== 'unknown') {
    let tier = TIER_BY_ROAD_CLASS[segment.roadClass]

    const maxSpeed = tags?.maxspeed ? Number.parseInt(tags.maxspeed, 10) : undefined
    if (maxSpeed && Number.isFinite(maxSpeed) && maxSpeed > 80 && tier !== 'unsuitable') {
      tier = 'caution'
    }

    return tier
  }

  // Sem classificação estruturada nem enriquecimento — fallback temporário por nome.
  if (segment.roadName && HIGHWAY_NAME_PATTERN.test(segment.roadName)) return 'unsuitable'
  if (segment.roadName && ARTERIAL_NAME_PATTERN.test(segment.roadName)) return 'good'
  return 'good'
}

/**
 * Ajuste da classificação estrutural ao veículo selecionado.
 *
 * REGRAS DELIBERADAS SOBRE O QUE ESTE AJUSTE **NÃO** FAZ:
 * - nunca melhora um trecho para 'prohibited' → utilizável. Proibição só vem
 *   de sinal explícito do OSM (access=no, bicycle=no) e vale para todos os
 *   veículos igualmente — trocar de veículo no perfil não pode "liberar" uma
 *   via fechada;
 * - nunca inventa restrição legal. Tudo aqui é adequação/conforto, que é o
 *   eixo de qualidade, separado do eixo de elegibilidade (ver Eligibility);
 * - só age quando há DADO REAL. Sem `maxspeed` não há diferencial de
 *   velocidade para calcular, e sem `surface` não há piso para avaliar: nesses
 *   casos devolve a classificação estrutural intacta em vez de chutar.
 */
function applyVehicleAdjustment(
  base: SuitabilityTier,
  segment: RouteSegment,
  vehicle: VehicleClassificationContext,
): SuitabilityTier {
  // Proibido é proibido para qualquer veículo.
  if (base === 'prohibited') return base

  let tier = base
  const tags = segment.osmTags

  // Ciclovia/via designada é o melhor caso para todos, e para bicicleta
  // elétrica é literalmente a infraestrutura do veículo. Já tratado como
  // 'very-good' na classificação estrutural; nada a piorar aqui.
  const isDesignatedCycleway = tags?.bicycle != null && /^(yes|designated)$/i.test(tags.bicycle.trim())

  const maxSpeed = tags?.maxspeed ? Number.parseInt(tags.maxspeed, 10) : undefined
  if (!isDesignatedCycleway && maxSpeed && Number.isFinite(maxSpeed)) {
    const differential = maxSpeed - vehicle.referenceSpeedKmh
    if (differential >= SPEED_DIFFERENTIAL_THRESHOLD_KMH) {
      tier = downgrade(tier)
    }
  }

  const sensitivity = LOOSE_SURFACE_SENSITIVITY[vehicle.modelId] ?? 'medium'
  if (sensitivity !== 'low' && isLooseSurface(tags?.surface)) {
    // 'high' (patinete, roda pequena) desce um nível; 'medium' só desce se o
    // trecho já não era ideal, para não transformar uma rua local tranquila
    // de piso compactado em "atenção" para uma scooter que aguenta bem.
    if (sensitivity === 'high' || tier !== 'very-good') {
      tier = downgrade(tier)
    }
  }

  return tier
}

/** Desce exatamente um degrau, sem nunca chegar a 'prohibited' — proibição não se infere. */
type NonProhibitedTier = Exclude<SuitabilityTier, 'prohibited'>

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
 * Elegibilidade é um eixo separado da pontuação (ver comentário de
 * Eligibility em types/routing.ts). 'unsuitable' continua ELEGÍVEL
 * ('discouraged') — o produto desaconselha vias rápidas/rodovias por
 * qualidade, mas não afirma que sejam proibidas sem um sinal explícito do
 * OSM (access=no, bicycle=no). Só esses sinais explícitos levam a 'prohibited'/'not-allowed'.
 */
export const TIER_ELIGIBILITY: Record<SuitabilityTier, Eligibility> = {
  'very-good': 'allowed',
  good: 'allowed',
  caution: 'allowed',
  unsuitable: 'discouraged',
  prohibited: 'not-allowed',
}

export const TIER_LABEL: Record<SuitabilityTier, string> = {
  'very-good': 'vias locais adequadas',
  good: 'avenidas/vias urbanas',
  caution: 'trechos de atenção (tráfego elevado)',
  unsuitable: 'vias expressas/rodovias',
  prohibited: 'trechos não utilizáveis',
}
