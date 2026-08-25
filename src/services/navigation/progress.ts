import { calculateEtaMinutes } from '@/services/routing/eta'
import { computeBearingDegrees, haversineDistanceMeters, projectPointOntoPath } from '@/utils/geo'
import type { LngLat } from '@/config/region'
import type { CandidateRoute, RouteStep } from '@/types/routing'

/**
 * Motor de navegação (Navigation Engine): calcula o estado da navegação a
 * partir de UMA posição atual e da rota ativa. É uma função pura,
 * deliberadamente desacoplada de como a posição foi obtida — hoje ela vem
 * do GPS real (useGeolocation, via watchPosition), mas o mesmo cálculo
 * serviria para uma posição simulada, sem qualquer mudança aqui.
 *
 * Estratégia: projeta a posição bruta sobre a geometria real da rota
 * (projectPointOntoPath), obtendo a distância já percorrida ao longo dela e
 * o quão longe o usuário está da rota (offRouteDistanceMeters) — a base
 * tanto do progresso (distância/ETA restantes, próxima instrução) quanto da
 * detecção de desvio de rota.
 */

const OFF_ROUTE_THRESHOLD_METERS = 40
const ARRIVAL_THRESHOLD_METERS = 20

export interface NavigationProgress {
  /** Posição do usuário "encaixada" na rota (usada para o marcador, mais estável que o GPS bruto). */
  snappedPosition: LngLat
  distanceTraveledMeters: number
  remainingDistanceMeters: number
  remainingDurationMinutes: number
  currentStepIndex: number
  /**
   * Nome da via em que o usuário está AGORA.
   *
   * Não é `nextStep.roadName` — esse é o nome da via DEPOIS da próxima
   * manobra. A via atual é a do passo cuja manobra já foi passada, porque
   * `RouteStep.roadName` descreve o trecho percorrido a partir daquela manobra
   * até a seguinte. null quando o provedor não nomeia a via (comum em
   * travessas e acessos).
   */
  currentRoadName: string | null
  /**
   * Direção em que a ROTA segue a partir da posição atual, em graus.
   *
   * Não é o rumo do GPS — é para onde o trajeto aponta daqui em diante. Serve
   * de fallback quando o GPS ainda não tem rumo confiável, o que acontece
   * sempre no início da navegação e em toda parada (o heading do aparelho só é
   * liberado acima de 3 km/h, e `coords.heading` vem null parado).
   *
   * Usar isto NÃO é inventar direção: numa navegação ativa, a direção do
   * trajeto à frente é justamente a informação que o usuário quer ver. É
   * inferência a partir da rota escolhida, não chute sobre o aparelho.
   */
  routeBearingDeg: number | null
  nextStep: RouteStep | null
  distanceToNextManeuverMeters: number
  /** Distância perpendicular entre a posição bruta do GPS e a rota. */
  offRouteDistanceMeters: number
  isOffRoute: boolean
  isComplete: boolean
}

export function computeNavigationProgress(
  route: CandidateRoute,
  rawPosition: LngLat,
  referenceSpeedKmh: number,
): NavigationProgress {
  const projection = projectPointOntoPath(rawPosition, route.geometry)
  const distanceTraveledMeters = projection?.distanceAlongMeters ?? 0
  const offRouteDistanceMeters = projection?.distanceFromPathMeters ?? Number.POSITIVE_INFINITY

  const remainingDistanceMeters = Math.max(0, route.totalDistanceMeters - distanceTraveledMeters)
  const remainingDurationMinutes = calculateEtaMinutes(remainingDistanceMeters, referenceSpeedKmh)

  const nextStep = route.steps.find((step) => step.cumulativeDistanceMeters > distanceTraveledMeters) ?? null
  const currentStepIndex = nextStep ? route.steps.indexOf(nextStep) : Math.max(0, route.steps.length - 1)
  const distanceToNextManeuverMeters = nextStep ? Math.max(0, nextStep.cumulativeDistanceMeters - distanceTraveledMeters) : 0

  // Passo em curso: o anterior ao da próxima manobra. Sem manobra pendente
  // (fim da rota), o último passo é o que descreve onde estamos.
  const currentStep = route.steps[Math.max(0, currentStepIndex - 1)] ?? null
  const currentRoadName = currentStep?.roadName ?? null

  const snapped = projection?.point ?? rawPosition
  const routeBearingDeg = bearingAlongRoute(route.geometry, snapped, distanceTraveledMeters)

  return {
    snappedPosition: projection?.point ?? rawPosition,
    distanceTraveledMeters,
    remainingDistanceMeters,
    remainingDurationMinutes,
    currentStepIndex,
    currentRoadName,
    routeBearingDeg,
    nextStep,
    distanceToNextManeuverMeters,
    offRouteDistanceMeters,
    isOffRoute: offRouteDistanceMeters > OFF_ROUTE_THRESHOLD_METERS,
    isComplete: remainingDistanceMeters <= ARRIVAL_THRESHOLD_METERS,
  }
}


/**
 * Rumo do trajeto a partir de um ponto: a direção do ponto encaixado para um
 * ponto ADIANTE na geometria.
 *
 * A folga de `BEARING_LOOKAHEAD_METERS` existe porque medir contra o vértice
 * imediatamente seguinte dá um ângulo que salta a cada vértice — a geometria
 * tem pontos muito próximos em curvas, e ali dois vértices vizinhos quase não
 * definem direção nenhuma.
 */
const BEARING_LOOKAHEAD_METERS = 25

function bearingAlongRoute(
  geometry: LngLat[],
  from: LngLat,
  distanceTraveledMeters: number,
): number | null {
  if (geometry.length < 2) return null

  // Caminha a geometria até passar da posição atual, e segue mais um trecho.
  let cursor = 0
  const target = distanceTraveledMeters + BEARING_LOOKAHEAD_METERS
  for (let i = 1; i < geometry.length; i += 1) {
    cursor += haversineDistanceMeters(geometry[i - 1], geometry[i])
    if (cursor >= target) return computeBearingDegrees(from, geometry[i])
  }

  // Perto do fim: aponta para o último ponto, que ainda é a direção de chegada.
  const last = geometry[geometry.length - 1]
  return haversineDistanceMeters(from, last) < 1 ? null : computeBearingDegrees(from, last)
}
