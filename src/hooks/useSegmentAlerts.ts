import { useEffect, useRef, useState } from 'react'
import { nextSegmentAlert, type BannerAlert } from '@/services/navigation/segmentAlerts'
import { nextRidingTip } from '@/services/navigation/ridingTips'
import { fetchRainOutlook, type RainOutlook } from '@/services/weather/rain'
import { speak } from '@/services/navigation/voiceGuidance'
import type { NavigationProgress } from '@/services/navigation/progress'
import type { ScoredRoute } from '@/types/routing'

/**
 * O lado com EFEITO do alerta de trecho: memória do que já foi dito, relógio,
 * voz e o tempo que o aviso fica na tela.
 *
 * A decisão de "o que anunciar" mora em `segmentAlerts.ts`, que é pura. Esta
 * separação não é cerimônia: a regra de silêncio é a parte que erra fácil e a
 * única que dá para verificar sem simular uma navegação inteira.
 */

/** Quanto tempo o aviso fica visível. Longo o bastante para ler em movimento. */
const VISIBLE_MS = 9000
/** Frases curtas (até ~140 caracteres): o tempo de um alerta basta, e menos tempo na tela é menos mapa coberto. */
const TIP_VISIBLE_MS = 9000
/** A previsão é de grade larga e muda devagar: reconsultar a cada 10 min basta. */
const RAIN_REFRESH_MS = 10 * 60_000

interface Options {
  isNavigating: boolean
  scoredRoute: ScoredRoute | null
  progress: NavigationProgress | null
  voiceEnabled: boolean
  /** Dicas de condução ligadas nas preferências. */
  tipsEnabled: boolean
  /** A velocidade do USUÁRIO — as dicas falam dela ("seus 32 por hora"). */
  referenceSpeedKmh: number
}

export function useSegmentAlerts({ isNavigating, scoredRoute, progress, voiceEnabled, tipsEnabled, referenceSpeedKmh }: Options) {
  const [alert, setAlert] = useState<BannerAlert | null>(null)
  const announced = useRef<Set<string>>(new Set())
  const lastAlertAt = useRef<number | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const routeId = useRef<string | null>(null)
  // Dicas têm memória e relógio próprios: uma dica não pode atrasar um alerta
  // de trecho crítico, e vice-versa só depois de um respiro.
  const tipsAnnounced = useRef<Set<string>>(new Set())
  const lastTipAt = useRef<number | null>(null)
  const tripStartedAt = useRef<number>(Date.now())
  const rainRef = useRef<RainOutlook | null>(null)
  const positionRef = useRef(progress?.snappedPosition ?? null)
  positionRef.current = progress?.snappedPosition ?? null

  // Rota nova (inclusive por recálculo) zera a memória: os trechos são outros,
  // e as chaves antigas silenciariam avisos legítimos por coincidência de
  // índice de segmento.
  useEffect(() => {
    const id = scoredRoute?.route.id ?? null
    if (id === routeId.current) return
    routeId.current = id
    announced.current = new Set()
    lastAlertAt.current = null
    // As chaves das dicas são posições NESTA rota; em outra rota elas apontam
    // para lugares diferentes. Só "anoiteceu" vale por viagem, não por rota.
    tipsAnnounced.current = new Set([...tipsAnnounced.current].filter((key) => key === 'tip:night'))
    setAlert(null)
  }, [scoredRoute?.route.id])

  /*
    COMEÇAR UMA NAVEGAÇÃO ESQUECE o que já foi anunciado.

    A memória só era limpa quando a ROTA mudava. Então refazer o mesmo trajeto
    — sair e iniciar de novo, que é o caso comum de quem repete o percurso de
    todo dia — corria em silêncio: os trechos já tinham sido anunciados na
    sessão anterior e nunca mais avisavam.

    A regra certa é "uma vez por navegação", não "uma vez por rota".
  */
  useEffect(() => {
    if (!isNavigating) return
    announced.current = new Set()
    lastAlertAt.current = null
    tipsAnnounced.current = new Set()
    lastTipAt.current = null
    tripStartedAt.current = Date.now()
  }, [isNavigating])

  // Previsão de chuva: consulta ao começar e a cada 10 min enquanto navega. Uma
  // segunda tentativa curta cobre o caso de a posição ainda não existir no
  // primeiro instante da navegação.
  useEffect(() => {
    if (!isNavigating || !tipsEnabled) {
      rainRef.current = null
      return
    }
    let cancelled = false
    const load = async () => {
      const position = positionRef.current
      if (!position) return
      const outlook = await fetchRainOutlook(position.lat, position.lng)
      if (!cancelled) rainRef.current = outlook
    }
    void load()
    const retry = setTimeout(() => { if (!rainRef.current) void load() }, 5000)
    const refresh = setInterval(() => void load(), RAIN_REFRESH_MS)
    return () => {
      cancelled = true
      clearTimeout(retry)
      clearInterval(refresh)
    }
  }, [isNavigating, tipsEnabled])

  useEffect(() => {
    if (!isNavigating) {
      setAlert(null)
      return
    }
    if (!scoredRoute || !progress) return

    const found = nextSegmentAlert({
      route: scoredRoute.route,
      severity: scoredRoute.severity,
      distanceTraveledMeters: progress.distanceTraveledMeters,
      announcedRunKeys: announced.current,
      lastAlertAt: lastAlertAt.current,
    })
    if (!found) {
      if (!tipsEnabled) return

      const now = Date.now()
      const tip = nextRidingTip({
        route: scoredRoute.route,
        distanceTraveledMeters: progress.distanceTraveledMeters,
        distanceToNextManeuverMeters: progress.distanceToNextManeuverMeters,
        referenceSpeedKmh,
        position: progress.snappedPosition,
        now,
        tripStartedAt: tripStartedAt.current,
        lastTipAt: lastTipAt.current,
        lastAlertAt: lastAlertAt.current,
        announced: tipsAnnounced.current,
        rain: rainRef.current,
      })
      if (!tip) return

      tipsAnnounced.current.add(tip.key)
      lastTipAt.current = now
      setAlert({ key: tip.key, level: 'tip', text: tip.text, headline: tip.headline })
      // `calm`: dica é conversa, não instrução — sai um pouco mais devagar, e
      // nunca fura a fila (só o incompatível fura).
      if (voiceEnabled) speak(tip.text, { calm: true })

      if (hideTimer.current) clearTimeout(hideTimer.current)
      hideTimer.current = setTimeout(() => setAlert(null), TIP_VISIBLE_MS)
      return
    }

    announced.current.add(found.key)
    lastAlertAt.current = Date.now()
    setAlert(found)

    /*
      VOZ: `urgent` só para o que é realmente urgente.

      A fila de fala existe para as instruções de manobra, e furá-la a cada
      aviso de trecho faria o alerta cortar um "vire à direita" — trocar
      informação essencial por informação de apoio. Um trecho incompatível é a
      exceção: ali a manobra seguinte importa menos que não entrar no lugar.
    */
    if (voiceEnabled) speak(found.speech, { urgent: found.level === 'incompatible' })

    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setAlert(null), VISIBLE_MS)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNavigating, scoredRoute, progress?.distanceTraveledMeters])

  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current) }, [])

  return { alert, dismiss: () => setAlert(null) }
}
