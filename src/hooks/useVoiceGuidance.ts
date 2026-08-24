import { useEffect, useRef } from 'react'
import type { NavigationProgress } from '@/services/navigation/progress'
import { clearPendingSpeech, speak, stopSpeaking } from '@/services/navigation/voiceGuidance'
import type { CandidateRoute } from '@/types/routing'

/**
 * Instruções faladas durante a navegação.
 *
 * Não precisou de nenhuma mudança na arquitetura de rotas: o
 * `computeNavigationProgress` já entrega, a cada atualização de GPS, o índice
 * do passo atual, a próxima manobra e a distância até ela. Este hook só
 * observa esses valores e decide QUANDO e O QUE falar — a serialização da
 * fala em si (fila + respiro entre frases) vive em services/navigation/voiceGuidance.
 *
 * O QUE MUDOU DEPOIS DO TESTE DE RUA: as instruções se atropelavam em
 * rotatórias e em sequências de manobras próximas. Eram três causas
 * distintas, e as três estão tratadas abaixo:
 *
 * 1. Anúncio antecipado disparando junto com o imediato. Um passo de 80 m já
 *    nasce com distância < 100 m, então o estágio "near" disparava no mesmo
 *    instante em que o passo começava e o "now" logo atrás. Agora um estágio
 *    só é falado se couber dentro do passo (ver `stageFitsInStep`).
 * 2. Falas concorrentes se cancelando. Cada `speak` novo cancelava o anterior
 *    no meio da frase. Agora só a instrução urgente ("agora") interrompe.
 * 3. Manobras encadeadas viravam duas frases coladas. Quando a manobra
 *    seguinte vem logo depois, as duas entram numa frase só ("...e em seguida
 *    vire à direita"), que é como um GPS de verdade fala.
 */

/** Limiares de antecipação, em metros. */
const ANNOUNCE_STAGES: { key: string; withinMeters: number }[] = [
  { key: 'far', withinMeters: 300 },
  { key: 'near', withinMeters: 100 },
  { key: 'now', withinMeters: 25 },
]

/**
 * Um anúncio antecipado só faz sentido se o passo for mais longo que o
 * limiar: dizer "em 300 metros vire" no começo de um passo de 80 m é falar de
 * uma manobra que já está a 80 m. Com margem de 20 m para o passo que fica
 * quase em cima do limiar.
 */
const STAGE_FIT_MARGIN_METERS = 20

/** Abaixo disso, a manobra seguinte é anunciada junto com a atual em vez de virar uma segunda frase. */
const CHAIN_NEXT_MANEUVER_WITHIN_METERS = 60

export function useVoiceGuidance(
  progress: NavigationProgress | null,
  enabled: boolean,
  isNavigating: boolean,
  route: CandidateRoute | null,
) {
  /** Chaves já faladas, no formato "índiceDoPasso:estágio" — evita repetir a cada tick do GPS. */
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

  // Rota nova (recálculo por desvio): o que estava na fila descreve manobras
  // que não existem mais. Descarta o pendente sem cortar a frase em curso.
  useEffect(() => {
    if (!isNavigating) return
    spokenRef.current.clear()
    clearPendingSpeech()
  }, [route, isNavigating])

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
      speak('Você chegou ao seu destino.', { urgent: true })
      return
    }

    const step = progress.nextStep
    if (!step) return

    const distance = progress.distanceToNextManeuverMeters
    // Só o estágio MAIS PRÓXIMO ainda não falado e que caiba no passo — se o
    // GPS pular (túnel, sinal fraco), anuncia direto o mais urgente em vez de
    // despejar os três de uma vez.
    const stage = ANNOUNCE_STAGES.filter(
      (entry) => distance <= entry.withinMeters && stageFitsInStep(entry, step.distanceMeters),
    ).pop()
    if (!stage) return

    const key = `${progress.currentStepIndex}:${stage.key}`
    if (spokenRef.current.has(key)) return
    spokenRef.current.add(key)

    // Os estágios mais antecipados do MESMO passo já não têm serventia depois
    // que o mais próximo foi falado — marcá-los evita que um tick atrasado do
    // GPS ainda dispare "em 300 metros" depois do "agora".
    for (const earlier of ANNOUNCE_STAGES) {
      if (earlier.withinMeters > stage.withinMeters) {
        spokenRef.current.add(`${progress.currentStepIndex}:${earlier.key}`)
      }
    }

    const followUp = route?.steps[progress.currentStepIndex + 1] ?? null
    const chained = followUp != null && followUp.distanceMeters <= CHAIN_NEXT_MANEUVER_WITHIN_METERS

    // Se a manobra seguinte foi dita junto ("...e em seguida vire à direita"),
    // ela não deve ser repetida sozinha alguns segundos depois — repetir é
    // exatamente o atropelamento relatado nas rotatórias.
    if (chained) {
      for (const entry of ANNOUNCE_STAGES) {
        spokenRef.current.add(`${progress.currentStepIndex + 1}:${entry.key}`)
      }
    }

    speak(buildSpokenInstruction(step.instruction, stage.key, distance, followUp), {
      urgent: stage.key === 'now',
    })
  }, [progress, enabled, isNavigating, route])
}

function stageFitsInStep(stage: { withinMeters: number }, stepDistanceMeters: number): boolean {
  // O estágio imediato ("agora") vale sempre: é o que efetivamente comanda a manobra.
  if (stage.withinMeters <= 25) return true
  return stepDistanceMeters + STAGE_FIT_MARGIN_METERS >= stage.withinMeters
}

/**
 * Monta a frase falada a partir da instrução que o provedor já entregou em
 * português ("Vire à esquerda para Rua T-55"). Nunca inventa manobra: só
 * acrescenta o contexto de distância na frente e, quando a manobra seguinte
 * vem logo em seguida, encadeia as duas numa frase só.
 */
function buildSpokenInstruction(
  instruction: string,
  stage: string,
  distanceMeters: number,
  followUp: { instruction: string; distanceMeters: number } | null,
): string {
  const base =
    stage === 'now'
      ? `${instruction} agora`
      : // Arredonda para múltiplos de 50 m — "em 287 metros" soa a robô.
        `Em ${Math.max(50, Math.round(distanceMeters / 50) * 50)} metros, ${lowercaseFirst(instruction)}`

  // Encadeamento: em rotatória e em cruzamentos seguidos, a manobra seguinte
  // chega antes de a próxima frase caber. Falar as duas juntas é o que evita
  // a sensação de voz atropelada — e é o comportamento de um GPS de verdade.
  if (followUp && followUp.distanceMeters <= CHAIN_NEXT_MANEUVER_WITHIN_METERS) {
    return `${base}, e em seguida ${lowercaseFirst(followUp.instruction)}.`
  }

  return `${base}.`
}

function lowercaseFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1)
}
