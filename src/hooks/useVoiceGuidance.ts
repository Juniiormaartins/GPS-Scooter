import { useEffect, useRef } from 'react'
import type { NavigationProgress } from '@/services/navigation/progress'
import { clearPendingSpeech, speak, stopSpeaking } from '@/services/navigation/voiceGuidance'
import type { CandidateRoute, RouteStep } from '@/types/routing'

/**
 * Instruções faladas durante a navegação.
 *
 * O `computeNavigationProgress` já entrega, a cada amostra de GPS, o passo
 * atual, a próxima manobra e a distância até ela. Este hook decide QUANDO e O
 * QUE falar; a serialização da fala (fila + respiro) vive em
 * services/navigation/voiceGuidance.
 *
 * ESTRATÉGIA EM QUATRO MOMENTOS. Cada um responde a uma pergunta diferente, e
 * é a ausência dos dois extremos que fazia a navegação parecer muda:
 *
 *   1. ANTECIPADO  — "Em 400 metros, vire à direita para Rua 10."
 *                    Só quando o passo é longo o bastante para o aviso caber;
 *                    num passo de 80 m ele dispararia junto com o comando.
 *   2. PREPARAÇÃO  — "Em 150 metros, vire à direita." (ver buildSpokenInstruction)
 *                    O momento de mudar de faixa, olhar o retrovisor.
 *   3. COMANDO     — o texto do provedor, no instante da manobra.
 *   4. SEGUIMENTO  — "Continue por 800 metros."
 *                    É o que preenche o silêncio depois de uma manobra quando
 *                    a próxima está longe. Sem ele, o app ficava minutos mudo e
 *                    parecia ter travado.
 *
 * O TEXTO VEM DO PROVEDOR, não daqui. O Valhalla produz `verbalAlert`,
 * `verbalPre` e `verbalPost` já em português e já com a contagem de saída de
 * rotatória ("siga pela segunda saída"), que nenhuma frase montada por nós
 * teria. Só a moldura de distância é nossa. Quando o provedor não fornece
 * (OSRM), caímos no texto da instrução, que a camada de provedor já monta em
 * português.
 */

/** Limiares de antecipação, em metros. */
const ANNOUNCE_STAGES = [
  { key: 'far', withinMeters: 400 },
  { key: 'prepare', withinMeters: 150 },
  { key: 'now', withinMeters: 30 },
] as const

type StageKey = (typeof ANNOUNCE_STAGES)[number]['key']

/**
 * Um aviso antecipado só faz sentido se couber dentro do passo: dizer "em 400
 * metros, vire" no começo de um passo de 90 m é anunciar algo que já está a
 * 90 m. Margem de 30 m para o passo que fica quase em cima do limiar.
 */
const STAGE_FIT_MARGIN_METERS = 30

/** Abaixo disso, a manobra seguinte é anunciada junto com a atual. */
const CHAIN_NEXT_MANEUVER_WITHIN_METERS = 80

/**
 * A partir deste comprimento, o passo ganha o aviso de seguimento ("continue
 * por X"). Abaixo disso não há silêncio para preencher.
 */
const FOLLOW_UP_MIN_STEP_METERS = 700

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

  useEffect(() => {
    if (isNavigating && enabled) return
    spokenRef.current.clear()
    hasAnnouncedStartRef.current = false
    hasAnnouncedArrivalRef.current = false
    stopSpeaking()
  }, [isNavigating, enabled])

  // Rota nova (recálculo por desvio, troca de alternativa): o que estava na
  // fila descreve manobras que não existem mais.
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

    const stepIndex = progress.currentStepIndex
    const distance = progress.distanceToNextManeuverMeters
    const say = (stageKey: string, text: string, urgent = false) => {
      const key = `${stepIndex}:${stageKey}`
      if (spokenRef.current.has(key)) return false
      spokenRef.current.add(key)
      speak(text, { urgent })
      return true
    }

    // SEGUIMENTO: logo depois de entrar num passo longo, diz quanto falta até
    // a próxima manobra. Dispara cedo (ainda longe do fim) justamente porque a
    // função dele é ocupar o silêncio que vem a seguir.
    const previousStep = route?.steps[stepIndex - 1]
    if (
      previousStep &&
      step.distanceMeters >= FOLLOW_UP_MIN_STEP_METERS &&
      distance > step.distanceMeters - 120 &&
      previousStep.verbalPost
    ) {
      if (say('follow', previousStep.verbalPost)) return
    }

    // Só o estágio MAIS PRÓXIMO ainda não falado e que caiba no passo — se o
    // GPS pular (túnel, sinal fraco), anuncia o mais urgente em vez de
    // despejar os três de uma vez.
    const stage = ANNOUNCE_STAGES.filter(
      (entry) => distance <= entry.withinMeters && stageFitsInStep(entry.key, step.distanceMeters),
    ).pop()
    if (!stage) return

    // Estágios mais antecipados do MESMO passo perdem a serventia depois que o
    // mais próximo foi falado.
    for (const earlier of ANNOUNCE_STAGES) {
      if (earlier.withinMeters > stage.withinMeters) spokenRef.current.add(`${stepIndex}:${earlier.key}`)
    }

    const followUp = route?.steps[stepIndex + 1] ?? null
    const chained = followUp != null && followUp.distanceMeters <= CHAIN_NEXT_MANEUVER_WITHIN_METERS
    if (chained) {
      for (const entry of ANNOUNCE_STAGES) spokenRef.current.add(`${stepIndex + 1}:${entry.key}`)
    }

    say(stage.key, buildSpokenInstruction(step, stage.key, distance, chained ? followUp : null), stage.key === 'now')
  }, [progress, enabled, isNavigating, route])
}

function stageFitsInStep(stage: StageKey, stepDistanceMeters: number): boolean {
  // O comando vale sempre: é o que efetivamente manda executar a manobra.
  if (stage === 'now') return true
  const threshold = ANNOUNCE_STAGES.find((entry) => entry.key === stage)?.withinMeters ?? 0
  return stepDistanceMeters + STAGE_FIT_MARGIN_METERS >= threshold
}

function buildSpokenInstruction(
  step: RouteStep,
  stage: StageKey,
  distanceMeters: number,
  chainedNext: RouteStep | null,
): string {
  // Preferência de texto por estágio: o provedor tem uma frase própria para o
  // aviso e outra para o comando, e elas diferem de propósito.
  const alertText = step.verbalAlert ?? step.instruction
  const commandText = step.verbalPre ?? step.instruction

  if (stage === 'far') {
    // Arredonda para múltiplos de 50 m — "em 287 metros" soa a robô.
    const rounded = Math.max(50, Math.round(distanceMeters / 50) * 50)
    return `Em ${rounded} metros, ${lowercaseFirst(stripTrailingPeriod(alertText))}.`
  }

  if (stage === 'prepare') {
    /**
     * A DISTÂNCIA no lugar de "Prepare-se".
     *
     * Duas razões, e a segunda é a que decide:
     *
     * 1. PRONÚNCIA. O motor lia "Prepare-se" como uma palavra só e saía
     *    "preparice" — medido pelos eventos `boundary` (ver speakableText em
     *    voiceGuidance.ts). A normalização já conserta isso para qualquer
     *    enclítico que venha do provedor, mas o texto que NÓS escrevemos não
     *    precisa depender dela.
     * 2. INFORMAÇÃO. A 150 m, "em 150 metros" diz mais que "prepare-se": o
     *    usuário sabe exatamente quando agir, e é o que todo navegador de
     *    verdade fala nesse estágio. A iminência vem do número.
     */
    const rounded = Math.max(50, Math.round(distanceMeters / 50) * 50)
    return `Em ${rounded} metros, ${lowercaseFirst(stripTrailingPeriod(alertText))}.`
  }

  const base = stripTrailingPeriod(commandText)
  if (chainedNext) {
    const next = chainedNext.verbalPre ?? chainedNext.instruction
    return `${base}, e em seguida ${lowercaseFirst(stripTrailingPeriod(next))}.`
  }
  return `${base}.`
}

function stripTrailingPeriod(text: string): string {
  return text.trim().replace(/\.$/, '')
}

function lowercaseFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1)
}
