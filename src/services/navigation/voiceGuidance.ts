/**
 * Síntese de voz para as instruções de navegação (Web Speech API).
 *
 * Escolha da API, com as limitações verificadas antes de implementar:
 * - `speechSynthesis` EXISTE no Safari/iOS, diferente do Web Bluetooth. É a
 *   única opção de voz que funciona num PWA sem baixar áudio.
 * - iOS/Safari exige que a PRIMEIRA fala parta de um gesto do usuário
 *   (toque). Por isso `primeFromUserGesture()` é chamado no toque que liga a
 *   voz: ele fala um enunciado vazio só para destravar o canal de áudio.
 *   Sem isso, as instruções seguintes (disparadas por GPS, não por toque)
 *   seriam silenciosamente ignoradas no iPhone.
 * - A lista de vozes carrega de forma assíncrona (`voiceschanged`), então a
 *   voz pt-BR é resolvida sob demanda, não no carregamento do módulo.
 */

export const isSpeechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

function pickPortugueseVoice(): SpeechSynthesisVoice | null {
  if (!isSpeechSupported) return null
  const voices = window.speechSynthesis.getVoices()
  return (
    voices.find((voice) => voice.lang === 'pt-BR') ??
    voices.find((voice) => voice.lang.startsWith('pt')) ??
    null
  )
}

/**
 * Destrava o áudio no iOS. Precisa ser chamado DENTRO do handler de um toque
 * real do usuário — chamar depois, de um callback de GPS, não funciona.
 */
export function primeFromUserGesture() {
  if (!isSpeechSupported) return
  const utterance = new SpeechSynthesisUtterance('')
  utterance.volume = 0
  window.speechSynthesis.speak(utterance)
}

/**
 * Fala uma instrução. `interrupt` cancela o que estiver na fila — usado nas
 * instruções urgentes ("vire agora"), que não podem esperar uma antecipada
 * mais longa terminar.
 */
export function speak(text: string, { interrupt = false }: { interrupt?: boolean } = {}) {
  if (!isSpeechSupported) return

  if (interrupt) window.speechSynthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'pt-BR'
  utterance.rate = 1.05 // Levemente acelerado: em deslocamento, instrução curta é melhor que pausada.
  const voice = pickPortugueseVoice()
  if (voice) utterance.voice = voice

  window.speechSynthesis.speak(utterance)
}

export function stopSpeaking() {
  if (isSpeechSupported) window.speechSynthesis.cancel()
}
