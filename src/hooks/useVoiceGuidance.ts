import { useEffect, useRef } from 'react'
import type { NavigationProgress } from '@/services/navigation/progress'
import { speak, stopSpeaking } from '@/services/navigation/voiceGuidance'

/**
 * Instruções faladas durante a navegação.
 *
 * Não precisou de nenhuma mudança na arquitetura de rotas: o
 * `computeNavigationProgress` já entrega, a cada atualização de GPS, o índice
 * do passo atual, a próxima manobra e a distância até ela. Este hook só
 * observa esses valores e decide QUANDO falar.
 *
 * Três anúncios por manobra, em limiares decrescentes de distância. Cada um
 * é falado no máximo uma vez por passo (`spokenRef`), senão a voz repetiria a
 * cada tick do GPS — que chega várias vezes por segundo.
 */

/** Limiares em metros. `null` = "agora", disparado ao chegar bem perto da manobra. */
const ANNOUNCE_STAGES: { key: string; withinMeters: number }[] = [
  { key: 'far', withinMeters: 300 },
  { key: 'near', withinMeters: 100 },
  { key: 'now', withinMeters: 25 },
]

export function useVoiceGuidance(progress: NavigationProgress | null, enabled: boolean, isNavigating: boolean) {
  /** Chaves já faladas, no formato "índiceDoPasso:estágio" — evita repetir a cada tick. */
  const spokenRef = useRef<Set<string>>(new Set())
  const hasAnnouncedStartRef = useRef(false)
  const hasAnnouncedArrivalRef = useRef(false)

  // Sessão nova (ou voz desligada) começa do zero: sem isso, retomar uma
  // navegação ficaria mudo porque as chaves antigas ainda estariam marcadas.
  useEffect(() => {
    if (isNavigating && enabled) return
    spokenRef.current.clear()
    hasAnnouncedStartRef.current = false
    hasAnnouncedArrivalRef.current = false
    stopSpeaking()
  }, [isNavigating, enabled])

  useEffect(() => {
    if (!enabled || !isNavigating) return

    if (!hasAnnouncedStartRef.current) {
      hasAnnouncedStartRef.current = true
      speak('Navegação iniciada.')
      return
    }

    if (!progress) return

    if (progress.isComplete) {
      if (hasAnnouncedArrivalRef.current) return
      hasAnnouncedArrivalRef.current = true
      speak('Você chegou ao seu destino.', { interrupt: true })
      return
    }

    const step = progress.nextStep
    if (!step) return

    const distance = progress.distanceToNextManeuverMeters
    // Só o estágio MAIS PRÓXIMO que ainda não foi falado — se o GPS pular
    // (túnel, sinal fraco), anuncia direto o mais urgente em vez de
    // despejar os três de uma vez.
    const stage = ANNOUNCE_STAGES.filter((entry) => distance <= entry.withinMeters).pop()
    if (!stage) return

    const key = `${progress.currentStepIndex}:${stage.key}`
    if (spokenRef.current.has(key)) return
    spokenRef.current.add(key)

    speak(buildSpokenInstruction(step.instruction, stage.key, distance), { interrupt: stage.key === 'now' })
  }, [progress, enabled, isNavigating])
}

/**
 * Monta a frase falada a partir da instrução que o provedor já entregou em
 * português ("Vire à esquerda para Rua T-55"). Nunca inventa manobra: só
 * acrescenta o contexto de distância na frente.
 */
function buildSpokenInstruction(instruction: string, stage: string, distanceMeters: number): string {
  if (stage === 'now') return `${instruction} agora.`

  // Arredonda para múltiplos de 50 m — "em 287 metros" soa a robô.
  const rounded = Math.max(50, Math.round(distanceMeters / 50) * 50)
  return `Em ${rounded} metros, ${lowercaseFirst(instruction)}.`
}

function lowercaseFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1)
}
