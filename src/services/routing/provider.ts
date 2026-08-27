import { env, isRoutingConfigured } from '@/config/env'
import type { LngLat } from '@/config/region'
import type { CandidateRoute, ManeuverType, RouteRequest, RouteSegment, RouteStep } from '@/types/routing'
import { mobilityProfile, type MobilityProfile } from '@/config/mobilityProfiles'
import { getUserPreferences } from '@/config/userPreferences'
import { looksEnglish, normalizeInstruction } from '@/services/routing/instructions'

/**
 * Camada de integração com o provedor externo de roteamento.
 * Toda limitação específica do provedor (formato de resposta, ausência de
 * classificação estruturada de vias, etc.) deve ficar isolada aqui —
 * o restante da aplicação só conhece CandidateRoute.
 */
export interface RoutingProvider {
  isConfigured: boolean
  fetchCandidateRoutes(request: RouteRequest): Promise<CandidateRoute[]>
}

/**
 * Teto de espera para os provedores de rota. Ambos são servidores públicos de
 * demonstração, sem SLA — se um pendurar, o app não pode ficar em
 * "Calculando rota…" para sempre. Como as duas fontes são combinadas via
 * Promise.allSettled, uma que estoure não impede a outra de responder.
 */
const ROUTE_FETCH_TIMEOUT_MS = 12000

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const abortController = new AbortController()
  const abortTimer = setTimeout(() => abortController.abort(), ROUTE_FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: abortController.signal })
  } finally {
    clearTimeout(abortTimer)
  }
}

class UnconfiguredRoutingProvider implements RoutingProvider {
  isConfigured = false

  async fetchCandidateRoutes(_request: RouteRequest): Promise<CandidateRoute[]> {
    throw new Error(
      'Provedor de roteamento não configurado. Defina VITE_ROUTING_BASE_URL (e VITE_ROUTING_API_KEY, se aplicável) no .env.',
    )
  }
}

interface OsrmStep {
  distance: number
  name: string
  geometry: { coordinates: [number, number][] }
  maneuver: { type: string; modifier?: string; location: [number, number] }
}

interface OsrmRoute {
  distance: number
  geometry: { coordinates: [number, number][] }
  legs: { steps: OsrmStep[] }[]
}

interface OsrmResponse {
  code: string
  routes: OsrmRoute[]
}

/**
 * Adapter para o servidor de demonstração pública do OSRM
 * (https://project-osrm.org) — gratuito, sem chave. Limitações conhecidas,
 * isoladas nesta camada:
 * - só expõe o perfil "driving" publicamente (não há perfil de scooter/moto
 *   elétrica hospedado publicamente); por isso a filtragem de vias inadequadas
 *   depende do ruleEngine (regras do GPS Scooter) aplicado sobre o resultado.
 * - não retorna classificação estruturada de via (RoadClass fica 'unknown');
 *   apenas o nome da via é preenchido, o que já é suficiente para a proteção
 *   temporária por nome (ex: BR-153) do ruleEngine.
 * - servidor de demonstração público, sem SLA — não recomendado para produção.
 */
class OsrmRoutingProvider implements RoutingProvider {
  isConfigured = true

  constructor(private readonly baseUrl: string) {}

  async fetchCandidateRoutes({ origin, destination }: RouteRequest): Promise<CandidateRoute[]> {
    const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`
    const params = new URLSearchParams({
      overview: 'full',
      geometries: 'geojson',
      steps: 'true',
      alternatives: 'true',
    })

    const response = await fetchWithTimeout(`${this.baseUrl}/route/v1/driving/${coords}?${params.toString()}`)
    if (!response.ok) {
      throw new Error('Não foi possível calcular a rota agora. Tente novamente.')
    }

    const data = (await response.json()) as OsrmResponse
    if (data.code !== 'Ok' || data.routes.length === 0) {
      throw new Error('Nenhuma rota encontrada entre a origem e o destino informados.')
    }

    return data.routes.map((route, index) => toCandidateRoute(route, index))
  }
}

function toCandidateRoute(route: OsrmRoute, index: number): CandidateRoute {
  const osrmSteps = route.legs.flatMap((leg) => leg.steps)

  const segments: RouteSegment[] = osrmSteps.map((step) => ({
    path: toLngLatList(step.geometry.coordinates),
    distanceMeters: step.distance,
    roadClass: 'unknown',
    roadName: step.name || undefined,
  }))

  let cumulativeDistanceMeters = 0
  const steps: RouteStep[] = osrmSteps.map((step) => {
    const routeStep: RouteStep = {
      maneuver: toManeuverType(step.maneuver.type, step.maneuver.modifier),
      instruction: buildInstruction(step.maneuver.type, step.maneuver.modifier, step.name),
      roadName: step.name || undefined,
      distanceMeters: step.distance,
      point: { lng: step.maneuver.location[0], lat: step.maneuver.location[1] },
      cumulativeDistanceMeters,
    }
    cumulativeDistanceMeters += step.distance
    return routeStep
  })

  return {
    id: `osrm-${index}`,
    segments,
    totalDistanceMeters: route.distance,
    geometry: toLngLatList(route.geometry.coordinates),
    steps,
  }
}

/**
 * Traduz `maneuver.type`/`maneuver.modifier` do OSRM (vocabulário documentado
 * em https://project-osrm.org, compartilhado com a especificação OSRM/Valhalla)
 * para o ManeuverType simplificado do app — nunca inventa manobras que o
 * provedor não informou.
 */
function toManeuverType(type: string, modifier?: string): ManeuverType {
  if (type === 'depart') return 'depart'
  if (type === 'arrive') return 'arrive'
  if (type === 'roundabout' || type === 'rotary') return 'roundabout'

  if (modifier?.includes('left')) return 'turn-left'
  if (modifier?.includes('right')) return 'turn-right'
  if (modifier === 'straight' || type === 'new name' || type === 'continue') return 'straight'

  return 'other'
}

/** Monta uma instrução legível em pt-BR a partir dos campos estruturados do OSRM. */
function buildInstruction(type: string, modifier: string | undefined, roadName: string): string {
  const via = roadName ? ` em ${roadName}` : ''

  if (type === 'depart') return `Siga${roadName ? ` por ${roadName}` : ' em frente'}`
  if (type === 'arrive') return 'Você chegou ao destino'
  if (type === 'roundabout' || type === 'rotary') return `Entre na rotatória${via}`
  if (modifier?.includes('left')) return `Vire à esquerda${via}`
  if (modifier?.includes('right')) return `Vire à direita${via}`
  if (modifier === 'straight' || type === 'new name' || type === 'continue') return `Continue${roadName ? ` por ${roadName}` : ' em frente'}`

  return `Siga${via}`
}

function toLngLatList(coordinates: [number, number][]): LngLat[] {
  return coordinates.map(([lng, lat]) => ({ lng, lat }))
}

const VALHALLA_BASE_URL = 'https://valhalla1.openstreetmap.de'
/** Identifica o app nas requisições ao servidor demo público, conforme boa prática pedida pelo mantenedor (ver https://github.com/valhalla/valhalla/discussions/3373). */
const VALHALLA_CLIENT_ID = 'gps-scooter.app'

interface ValhallaManeuver {
  instruction: string
  street_names?: string[]
  length: number
  begin_shape_index: number
  end_shape_index: number
  /**
   * Textos prontos para VOZ. O Valhalla os produz em três estágios (aviso
   * antecipado, momento da manobra, depois da manobra), que é exatamente a
   * estrutura que uma navegação falada precisa.
   */
  verbal_transition_alert_instruction?: string
  verbal_pre_transition_instruction?: string
  verbal_post_transition_instruction?: string
  /** Número da saída da rotatória — dado estruturado, não texto. */
  roundabout_exit_count?: number
}

interface ValhallaLeg {
  shape: string
  maneuvers: ValhallaManeuver[]
}

interface ValhallaTrip {
  legs: ValhallaLeg[]
  summary: { length: number; time: number; has_highway?: boolean }
}

interface ValhallaResponse {
  trip: ValhallaTrip
  alternates?: { trip: ValhallaTrip }[]
}

/**
 * Decodifica um polyline Valhalla (precisão 1e-6, formato compartilhado com
 * Google Polyline mas com mais casas decimais) em uma lista de pontos
 * [lat, lng] — algoritmo padrão, sem dependência externa.
 */
function decodeValhallaPolyline(encoded: string): [number, number][] {
  const precision = 1e6
  const points: [number, number][] = []
  let index = 0
  let lat = 0
  let lng = 0

  while (index < encoded.length) {
    let shift = 0
    let result = 0
    let byte: number
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    lat += result & 1 ? ~(result >> 1) : result >> 1

    shift = 0
    result = 0
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    lng += result & 1 ? ~(result >> 1) : result >> 1

    points.push([lat / precision, lng / precision])
  }

  return points
}

/** Deriva o tipo de manobra simplificado a partir do TEXTO da instrução (já em pt-BR) — mais robusto que decodificar o enum numérico do Valhalla, e segue o mesmo princípio de nunca inventar uma manobra que o provedor não descreveu. */
function maneuverTypeFromInstruction(instruction: string, isFirst: boolean, isLast: boolean): ManeuverType {
  if (isFirst) return 'depart'
  if (isLast) return 'arrive'
  const lower = instruction.toLowerCase()
  if (lower.includes('rotatória') || lower.includes('rotunda')) return 'roundabout'
  if (lower.includes('esquerda')) return 'turn-left'
  if (lower.includes('direita')) return 'turn-right'
  return 'straight'
}

function valhallaTripToCandidateRoute(trip: ValhallaTrip, id: string): CandidateRoute {
  const leg = trip.legs[0]
  const shapePoints = decodeValhallaPolyline(leg.shape)
  const geometry: LngLat[] = shapePoints.map(([lat, lng]) => ({ lat, lng }))

  const segments: RouteSegment[] = []
  const steps: RouteStep[] = []
  let cumulativeDistanceMeters = 0

  leg.maneuvers.forEach((maneuver, index) => {
    const path = geometry.slice(maneuver.begin_shape_index, maneuver.end_shape_index + 1)
    const distanceMeters = maneuver.length * 1000
    const roadName = maneuver.street_names?.[0]

    segments.push({ path: path.length >= 2 ? path : geometry.slice(maneuver.begin_shape_index, maneuver.begin_shape_index + 2), distanceMeters, roadClass: 'unknown', roadName })

    // A locale pt-BR do Valhalla é incompleta para rotatórias com nome — ele
    // cai no template em inglês. `normalizeInstruction` reescreve a moldura
    // usando `roundabout_exit_count`, que é dado estruturado (ver instructions.ts).
    const exitCount = maneuver.roundabout_exit_count ?? null
    const instruction = normalizeInstruction(maneuver.instruction, exitCount)

    /**
     * A rede de segurança precisava estar LIGADA.
     *
     * `looksEnglish` existia para avisar quando a locale do Valhalla soltasse
     * uma moldura em inglês que a normalização não cobre — mas nada a
     * chamava, então ela nunca avisou nada. Uma frase nova em inglês chegaria
     * ao usuário em silêncio, que é exatamente o que ela deveria impedir.
     *
     * Só em desenvolvimento: em produção um aviso no console não ajuda
     * ninguém e o texto já é o melhor disponível.
     */
    if (import.meta.env.DEV && looksEnglish(instruction)) {
      console.warn('[rota] instrução não traduzida pela locale do Valhalla:', instruction)
    }

    steps.push({
      maneuver: maneuverTypeFromInstruction(maneuver.instruction, index === 0, index === leg.maneuvers.length - 1),
      instruction,
      roadName,
      distanceMeters,
      point: path[0] ?? geometry[maneuver.begin_shape_index] ?? geometry[0],
      cumulativeDistanceMeters,
      verbalAlert: maneuver.verbal_transition_alert_instruction
        ? normalizeInstruction(maneuver.verbal_transition_alert_instruction, exitCount)
        : undefined,
      verbalPre: maneuver.verbal_pre_transition_instruction
        ? normalizeInstruction(maneuver.verbal_pre_transition_instruction, exitCount)
        : undefined,
      verbalPost: maneuver.verbal_post_transition_instruction
        ? normalizeInstruction(maneuver.verbal_post_transition_instruction, exitCount)
        : undefined,
    })
    cumulativeDistanceMeters += distanceMeters
  })

  return {
    id,
    segments,
    totalDistanceMeters: trip.summary.length * 1000,
    geometry,
    steps,
  }
}

/**
 * Adapter para o servidor de demonstração pública do Valhalla
 * (https://valhalla.openstreetmap.de — mantido pela FOSSGIS/OpenStreetMap
 * Alemanha, mesmo nível de governança comunitária do Nominatim/Overpass/OSRM
 * demo já usados no app; sem chave, rate limit ~1 req/s por usuário).
 *
 * Existe porque, testado empiricamente (ver relatório de auditoria de
 * rotas): o profile "driving" do OSRM demo (a) não hospeda de fato perfis de
 * bicicleta/pedestre — as URLs /bike/ e /foot/ existem mas retornam
 * exatamente a mesma rota do perfil de carro, um alias, não um perfil real;
 * (b) não suporta `exclude=motorway` ("Exclude flag combination is not
 * supported"); (c) suas alternativas (no máximo 2, mesmo pedindo mais)
 * convergem na mesma rodovia problemática — em um teste real Goiânia→
 * Aparecida de Goiânia, AMBAS as rotas do OSRM passavam pela mesma
 * "Rodovia Transbrasiliana".
 *
 * O costing "bicycle" do Valhalla evita rodovia/via expressa de forma
 * ESTRUTURAL (não é uma penalização a posteriori) — testado no mesmo
 * trajeto: 3 candidatas (principal + 2 alternates), todas com
 * `has_highway: false`, todas por vias urbanas. Perfil de veículo
 * autopropelido de baixa velocidade é uma aproximação muito mais realista
 * para um scooter elétrico do que o perfil de carro.
 */
class ValhallaRoutingProvider implements RoutingProvider {
  isConfigured = true

  /**
   * `costing` é escolhido pelo PERFIL DE MOBILIDADE, não fixo.
   *
   * Antes os três veículos pediam `bicycle`. Medido na instância pública, no
   * mesmo trajeto: `bicycle` 9,21 km sem rodovia; `motor_scooter` 9,22 km sem
   * rodovia mas 26 min em vez de 33 (ele sabe que o veículo é motorizado);
   * `pedestrian` 8,05 km, usando calçadas; `motorcycle` 10,56 km COM rodovia
   * — por isso motocicleta ficou de fora mesmo sendo "duas rodas".
   */
  constructor(
    private readonly useRoads: number,
    private readonly costing: MobilityProfile['costing'] = 'bicycle',
  ) {}

  async fetchCandidateRoutes({ origin, destination }: RouteRequest): Promise<CandidateRoute[]> {
    const body = {
      locations: [
        { lat: origin.lat, lon: origin.lng },
        { lat: destination.lat, lon: destination.lng },
      ],
      costing: this.costing,
      costing_options:
        this.costing === 'bicycle'
          ? { bicycle: { bicycle_type: 'City', use_roads: this.useRoads } }
          : undefined,
      alternates: 2,
      language: 'pt-BR',
      id: 'gps-scooter',
    }

    const response = await fetchWithTimeout(`${VALHALLA_BASE_URL}/route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Client-Id': VALHALLA_CLIENT_ID },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      throw new Error('Não foi possível calcular a rota agora. Tente novamente.')
    }

    const data = (await response.json()) as ValhallaResponse
    const trips = [data.trip, ...(data.alternates ?? []).map((alt) => alt.trip)]
    return trips.map((trip, index) => valhallaTripToCandidateRoute(trip, `valhalla-${this.costing}-${index}`))
  }
}

/**
 * Combina o Valhalla (costing "bicycle" — candidatas urbanas, evita rodovia
 * estruturalmente) com o OSRM (perfil "driving" — a rota mais rápida
 * disponível, mesmo que use via inadequada) numa única lista de candidatas.
 * O ruleEngine (services/routing/ruleEngine.ts) avalia TODAS igualmente —
 * a candidata do OSRM não ganha nenhum tratamento especial; se ela usar
 * rodovia, aparece com pontuação baixa e explicação clara, exatamente como
 * qualquer outra. É assim que a rota "mais rápida, porém menos adequada" (
 * prioridade 3 pedida) chega a existir como opção real, não uma
 * reclassificação da mesma candidata.
 */
class CombinedRoutingProvider implements RoutingProvider {
  isConfigured = true

  constructor(
    private readonly osrm: RoutingProvider,
    /** `use_roads` do costing de bicicleta: 0 evita via movimentada, 1 aceita. */
    private readonly useRoads = 0.5,
  ) {}

  async fetchCandidateRoutes(request: RouteRequest): Promise<CandidateRoute[]> {
    /**
     * O POOL DE CANDIDATAS É MONTADO PELO PERFIL DO VEÍCULO.
     *
     * - sempre o costing do perfil (bicicleta ou motor_scooter);
     * - o OSRM "driving" continua entrando, para que a rota mais rápida por
     *   via inadequada EXISTA como opção real e apareça classificada, em vez
     *   de sumir;
     */
    const profile = mobilityProfile(getUserPreferences().vehicleModelId)

    const sources: Promise<CandidateRoute[]>[] = [
      new ValhallaRoutingProvider(this.useRoads, profile.costing).fetchCandidateRoutes(request),
      this.osrm.fetchCandidateRoutes(request).then((routes) => routes.map((route) => ({ ...route, id: `driving-${route.id}` }))),
    ]

    const outcomes = await Promise.allSettled(sources)
    const combined = outcomes.flatMap((outcome) => (outcome.status === 'fulfilled' ? outcome.value : []))
    if (combined.length === 0) {
      throw new Error('Nenhuma rota encontrada entre a origem e o destino informados.')
    }
    return combined
  }
}

export function getRoutingProvider(): RoutingProvider {
  if (!isRoutingConfigured) {
    return new UnconfiguredRoutingProvider()
  }

  return new CombinedRoutingProvider(new OsrmRoutingProvider(env.routingBaseUrl))
}
