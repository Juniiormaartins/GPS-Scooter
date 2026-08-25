import { useEffect, useRef, useState } from 'react'
import { useGeolocation } from '@/hooks/useGeolocation'
import { computeNavigationProgress, type NavigationProgress } from '@/services/navigation/progress'
import { INITIAL_SPEED_STATE, speedKmhForDisplay, trackSpeed } from '@/services/navigation/speedTracker'
import { getUserPreferences } from '@/config/userPreferences'
import { computeBearingDegrees, haversineDistanceMeters } from '@/utils/geo'
import type { CandidateRoute } from '@/types/routing'

/**
 * Amostras consecutivas fora da rota antes de considerar desvio "real".
 *
 * Eram 3, ou seja ~3 segundos de atraso somados ao limiar largo de distância —
 * a 30 km/h isso é meio quarteirão percorrido antes de o app perceber. Com o
 * limiar de distância agora mais estrito (22 m), 2 amostras bastam para
 * descartar um ponto isolado ruim sem prolongar a espera.
 */
const SUSTAINED_OFF_ROUTE_SAMPLES = 2

/**
 * Deslocamento mínimo entre duas amostras para inferir direção a partir delas.
 * Abaixo disso o "movimento" é só ruído do GPS parado, e usar isso faria o
 * mapa girar sozinho com o usuário imóvel.
 */
const MIN_MOVEMENT_FOR_BEARING_METERS = 6

/**
 * Abaixo desta velocidade a direção não é atualizada.
 *
 * O heading do GPS é derivado do deslocamento: parado, ele aponta para onde o
 * ruído da posição pulou por último e gira sozinho. Sem esta trava, o mapa
 * roda no semáforo com o usuário imóvel — que é o pior momento para isso,
 * porque a pessoa está olhando a tela. 3 km/h é abaixo de passo de caminhada.
 */
const MIN_SPEED_FOR_HEADING_KMH = 3

/**
 * Suavização angular do heading (0 = trava, 1 = segue o valor bruto na hora).
 *
 * O heading bruto oscila alguns graus a cada amostra mesmo em linha reta, e
 * repassar isso direto para a câmera faz o mapa tremer. 0.25 absorve o ruído
 * e ainda vira uma esquina de 90° em ~4 amostras (≈4 s), que é o tempo real
 * de fazer a curva.
 */
const HEADING_SMOOTHING = 0.4

/**
 * Acima desta diferença, assume a direção nova de uma vez em vez de
 * interpolar. É o caso do retorno/curva fechada: interpolar 170° faria a
 * câmera girar lentamente por vários segundos, apontando para o lado errado
 * durante a manobra inteira.
 */
const HEADING_SNAP_THRESHOLD_DEGREES = 100

/**
 * Interpola entre dois ângulos pelo caminho mais curto. Sem tratar o
 * wrap-around, ir de 350° para 10° (20° de diferença real) seria interpretado
 * como uma volta de 340° para o outro lado — o mapa girando quase por
 * completo cada vez que o usuário cruza o norte.
 */
function smoothHeading(previous: number | null, next: number): number {
  if (previous == null) return next

  let delta = ((next - previous + 540) % 360) - 180
  if (Math.abs(delta) >= HEADING_SNAP_THRESHOLD_DEGREES) return next

  delta *= HEADING_SMOOTHING
  return (previous + delta + 360) % 360
}

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

    const speedKmh = speedKmhForDisplay(speedStateRef.current)

    // A direção só é atualizada com movimento comprovado. Parado, mantém a
    // última direção conhecida — melhor um valor levemente velho do que a
    // câmera girando sozinha.
    if (speedKmh == null || speedKmh >= MIN_SPEED_FOR_HEADING_KMH) {
      const previous = lastPositionRef.current
      const raw =
        sample.headingDeg != null && !Number.isNaN(sample.headingDeg)
          ? sample.headingDeg
          : previous && haversineDistanceMeters(previous, sample.position) >= MIN_MOVEMENT_FOR_BEARING_METERS
            ? computeBearingDegrees(previous, sample.position)
            : null

      if (raw != null) {
        setHeadingDeg((current) => smoothHeading(current, raw))
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

  /**
   * Rumo efetivo: o do GPS quando confiável, senão o da ROTA à frente.
   *
   * Sem o fallback, todo início de navegação e toda parada em semáforo
   * deixavam o marcador sem direção — e ele degradava para o disco genérico
   * justamente nos momentos em que o usuário mais olha a tela. A direção do
   * trajeto é dado real; o que não temos parado é a orientação do APARELHO,
   * e essa continuamos sem afirmar.
   */
  const effectiveHeadingDeg = headingDeg ?? progress?.routeBearingDeg ?? null

  return {
    progress,
    gpsSample: sample,
    /** Velocidade real de deslocamento, já filtrada — null quando não há leitura confiável. */
    currentSpeedKmh,
    headingDeg: effectiveHeadingDeg,
    isLocating,
    locationError: error,
    permission,
    routeDeviated,
    acknowledgeRecalculation,
  }
}
