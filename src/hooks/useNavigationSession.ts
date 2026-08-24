import { useEffect, useRef, useState } from 'react'
import { useGeolocation } from '@/hooks/useGeolocation'
import { computeNavigationProgress, type NavigationProgress } from '@/services/navigation/progress'
import { INITIAL_SPEED_STATE, speedKmhForDisplay, trackSpeed } from '@/services/navigation/speedTracker'
import { getUserPreferences } from '@/config/userPreferences'
import { computeBearingDegrees, haversineDistanceMeters } from '@/utils/geo'
import type { CandidateRoute } from '@/types/routing'

/**
 * Amostras consecutivas fora da rota antes de considerar desvio "real" (e não
 * ruído momentâneo do GPS) — evita disparar recálculo por um único ponto
 * impreciso.
 */
const SUSTAINED_OFF_ROUTE_SAMPLES = 3

/**
 * Deslocamento mínimo entre duas amostras para inferir direção a partir delas.
 * Abaixo disso o "movimento" é só ruído do GPS parado, e usar isso faria o
 * mapa girar sozinho com o usuário imóvel.
 */
const MIN_MOVEMENT_FOR_BEARING_METERS = 6

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
  /**
   * Direção de deslocamento, em graus. Preferência: heading real do
   * dispositivo; se ausente (comum em GPS de baixa precisão ou parado),
   * infere pelo deslocamento entre amostras. Nunca é inventado: sem heading e
   * sem movimento suficiente, mantém o último valor conhecido — e permanece
   * null enquanto nunca houve nenhum.
   */
  const [headingDeg, setHeadingDeg] = useState<number | null>(null)
  const lastPositionRef = useRef<{ lng: number; lat: number } | null>(null)
  /**
   * Velocidade tratada (ver speedTracker.ts). Guardada em ref porque o estado
   * do filtro é acumulativo entre amostras; só o número exibido vira state.
   */
  const speedStateRef = useRef(INITIAL_SPEED_STATE)
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState<number | null>(null)

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
      setHeadingDeg(null)
      lastPositionRef.current = null
      speedStateRef.current = INITIAL_SPEED_STATE
      setCurrentSpeedKmh(null)
      return
    }

    if (!route || !sample) return

    speedStateRef.current = trackSpeed(speedStateRef.current, sample)
    setCurrentSpeedKmh(speedKmhForDisplay(speedStateRef.current))

    if (sample.headingDeg != null && !Number.isNaN(sample.headingDeg)) {
      setHeadingDeg(sample.headingDeg)
    } else {
      const previous = lastPositionRef.current
      if (previous && haversineDistanceMeters(previous, sample.position) >= MIN_MOVEMENT_FOR_BEARING_METERS) {
        setHeadingDeg(computeBearingDegrees(previous, sample.position))
      }
    }
    lastPositionRef.current = sample.position

    const next = computeNavigationProgress(route, sample.position, getUserPreferences().referenceSpeedKmh)
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
    /** Velocidade real de deslocamento, já filtrada — null quando não há leitura confiável. */
    currentSpeedKmh,
    headingDeg,
    isLocating,
    locationError: error,
    permission,
    routeDeviated,
    acknowledgeRecalculation,
  }
}
