/**
 * Síntese de voz para as instruções de navegação (Web Speech API).
 *
 * Escolha da API, com as limitações verificadas antes de implementar:
 * - `speechSynthesis` EXISTE no Safari/iOS, diferente do Web Bluetooth. É a
 *   única opção de voz que funciona num PWA sem baixar áudio.
 * - iOS/Safari exige que a PRIMEIRA fala parta de um gesto do usuário
 *   (toque). Por isso `primeFromUserGesture()` é chamado no toque que liga a
 *   voz — sem isso, as instruções seguintes (disparadas por GPS, não por
 *   toque) seriam silenciosamente ignoradas no iPhone.
 * - A lista de vozes carrega de forma assíncrona (`voiceschanged`).
 *
 * FILA: a fala é serializada aqui, não no hook. Em rotatórias e sequências de
 * manobras próximas, várias instruções podiam ser disparadas quase juntas e a
 * segunda cancelava a primeira no meio — a sensação de "voz se atropelando"
 * relatada em teste de rua. Agora cada fala espera a anterior terminar, mais
 * um respiro mínimo entre elas.
 */

export const isSpeechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

/** Respiro entre duas falas consecutivas — sem isso elas soam coladas. */
const MIN_GAP_BETWEEN_UTTERANCES_MS = 600

interface QueueItem {
  text: string
  /** Instruções urgentes ("vire agora") furam a fila e descartam o que estava pendente. */
  urgent: boolean
}

let queue: QueueItem[] = []
let isSpeaking = false
let preferredVoiceUri: string | null = null

/** Vozes em português disponíveis NO DISPOSITIVO — a lista real, nunca inventada. */
export function listPortugueseVoices(): SpeechSynthesisVoice[] {
  if (!isSpeechSupported) return []
  return window.speechSynthesis.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith('pt'))
}

/**
 * Notifica quando as vozes terminarem de carregar. No Chrome/Safari
 * `getVoices()` costuma vir vazio na primeira chamada — a lista chega depois,
 * de forma assíncrona, por este evento.
 */
export function onVoicesChanged(callback: () => void): () => void {
  if (!isSpeechSupported) return () => {}
  window.speechSynthesis.addEventListener('voiceschanged', callback)
  return () => window.speechSynthesis.removeEventListener('voiceschanged', callback)
}

export function setPreferredVoice(voiceUri: string | null) {
  preferredVoiceUri = voiceUri
}

function resolveVoice(): SpeechSynthesisVoice | null {
  const portuguese = listPortugueseVoices()
  if (preferredVoiceUri) {
    const chosen = portuguese.find((voice) => voice.voiceURI === preferredVoiceUri)
    if (chosen) return chosen
  }
  return portuguese.find((voice) => voice.lang === 'pt-BR') ?? portuguese[0] ?? null
}

function drainQueue() {
  if (isSpeaking || queue.length === 0 || !isSpeechSupported) return

  const item = queue.shift()!
  isSpeaking = true

  const utterance = new SpeechSynthesisUtterance(item.text)
  utterance.lang = 'pt-BR'
  utterance.rate = 1.0
  const voice = resolveVoice()
  if (voice) utterance.voice = voice

  const finish = () => {
    // O respiro entra DEPOIS de terminar, antes de liberar a próxima.
    setTimeout(() => {
      isSpeaking = false
      drainQueue()
    }, MIN_GAP_BETWEEN_UTTERANCES_MS)
  }
  utterance.onend = finish
  utterance.onerror = finish

  window.speechSynthesis.speak(utterance)
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
 * Enfileira uma instrução.
 *
 * `urgent` é para o momento da manobra ("vire agora"): descarta o que ainda
 * não foi falado (avisos antecipados que já perderam o sentido) e corta a
 * fala em andamento, porque nesse instante ela já está atrasada. Instruções
 * normais NUNCA interrompem — só entram na fila.
 */
export function speak(text: string, { urgent = false }: { urgent?: boolean } = {}) {
  if (!isSpeechSupported) return

  if (urgent) {
    queue = [{ text, urgent }]
    window.speechSynthesis.cancel()
    isSpeaking = false
    drainQueue()
    return
  }

  queue.push({ text, urgent })
  drainQueue()
}

/** Descarta o que está pendente sem cortar a fala atual — usado quando a rota é recalculada. */
export function clearPendingSpeech() {
  queue = []
}

export function stopSpeaking() {
  if (!isSpeechSupported) return
  queue = []
  isSpeaking = false
  window.speechSynthesis.cancel()
}
