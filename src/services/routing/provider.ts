import { env, isRoutingConfigured } from '@/config/env'
import type { LngLat } from '@/config/region'
import type { CandidateRoute, ManeuverType, RouteRequest, RouteSegment, RouteStep } from '@/types/routing'

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

    const response = await fetch(`${this.baseUrl}/route/v1/driving/${coords}?${params.toString()}`)
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

export function getRoutingProvider(): RoutingProvider {
  if (!isRoutingConfigured) {
    return new UnconfiguredRoutingProvider()
  }

  return new OsrmRoutingProvider(env.routingBaseUrl)
}
