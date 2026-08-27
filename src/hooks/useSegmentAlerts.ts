import { useEffect, useRef, useState } from 'react'
import { nextSegmentAlert, type SegmentAlert } from '@/services/navigation/segmentAlerts'
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

interface Options {
  isNavigating: boolean
  scoredRoute: ScoredRoute | null
  progress: NavigationProgress | null
  voiceEnabled: boolean
}

export function useSegmentAlerts({ isNavigating, scoredRoute, progress, voiceEnabled }: Options) {
  const [alert, setAlert] = useState<SegmentAlert | null>(null)
  const announced = useRef<Set<string>>(new Set())
  const lastAlertAt = useRef<number | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const routeId = useRef<string | null>(null)

  // Rota nova (inclusive por recálculo) zera a memória: os trechos são outros,
  // e as chaves antigas silenciariam avisos legítimos por coincidência de
  // índice de segmento.
  useEffect(() => {
    const id = scoredRoute?.route.id ?? null
    if (id === routeId.current) return
    routeId.current = id
    announced.current = new Set()
    lastAlertAt.current = null
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
  }, [isNavigating])

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
    if (!found) return

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
