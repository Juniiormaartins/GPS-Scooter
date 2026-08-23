import { calculateEtaMinutes } from '@/services/routing/eta'
import { projectPointOntoPath } from '@/utils/geo'
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

  return {
    snappedPosition: projection?.point ?? rawPosition,
    distanceTraveledMeters,
    remainingDistanceMeters,
    remainingDurationMinutes,
    currentStepIndex,
    nextStep,
    distanceToNextManeuverMeters,
    offRouteDistanceMeters,
    isOffRoute: offRouteDistanceMeters > OFF_ROUTE_THRESHOLD_METERS,
    isComplete: remainingDistanceMeters <= ARRIVAL_THRESHOLD_METERS,
  }
}
