import { useEffect, useRef, useState } from 'react'
import { useGeolocation } from '@/hooks/useGeolocation'
import { computeNavigationProgress, type NavigationProgress } from '@/services/navigation/progress'
import { VEHICLE_PROFILE } from '@/config/vehicle'
import type { CandidateRoute } from '@/types/routing'

/**
 * Amostras consecutivas fora da rota antes de considerar desvio "real" (e não
 * ruído momentâneo do GPS) — evita disparar recálculo por um único ponto
 * impreciso.
 */
const SUSTAINED_OFF_ROUTE_SAMPLES = 3

/**
 * Orquestra a navegação ativa (Estado D): liga o rastreamento contínuo de
 * localização (useGeolocation.startWatching) enquanto `active` for true,
 * recalcula o progresso a cada nova amostra de GPS (progress.ts) e sinaliza
 * quando o usuário se desviou da rota de forma sustentada — App.tsx decide o
 * que fazer com esse sinal (hoje: recalcular a rota a partir da posição atual).
 */
export function useNavigationSession(route: CandidateRoute | null, active: boolean) {
  const { sample, isLocating, error, permission, startWatching, stopWatching } = useGeolocation()
  const [progress, setProgress] = useState<NavigationProgress | null>(null)
  const [routeDeviated, setRouteDeviated] = useState(false)
  const offRouteStreakRef = useRef(0)

  useEffect(() => {
    if (!active) return
    startWatching()
    return () => stopWatching()
  }, [active, startWatching, stopWatching])

  useEffect(() => {
    if (!active) {
      offRouteStreakRef.current = 0
      setRouteDeviated(false)
      setProgress(null)
      return
    }

    if (!route || !sample) return

    const next = computeNavigationProgress(route, sample.position, VEHICLE_PROFILE.maxOperationalSpeedKmh)
    setProgress(next)

    if (next.isOffRoute) {
      offRouteStreakRef.current += 1
      if (offRouteStreakRef.current >= SUSTAINED_OFF_ROUTE_SAMPLES) {
        setRouteDeviated(true)
      }
    } else {
      offRouteStreakRef.current = 0
      setRouteDeviated(false)
    }
  }, [active, route, sample])

  function acknowledgeRecalculation() {
    offRouteStreakRef.current = 0
    setRouteDeviated(false)
  }

  return {
    progress,
    gpsSample: sample,
    isLocating,
    locationError: error,
    permission,
    routeDeviated,
    acknowledgeRecalculation,
  }
}
