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

/**
 * NORMALIZAÇÃO FONÉTICA — o texto que o motor RECEBE, não o que a tela mostra.
 *
 * PROBLEMA REAL, medido e não suposto. O aviso de preparação era
 * "Prepare-se: vire à direita." e o usuário ouvia algo como "preparice".
 * Instrumentando os eventos `boundary` do próprio motor:
 *
 *   "Prepare-se: vire à direita."  → boundary de 1 palavra, charLength 10
 *   "Prepare se: vire à direita."  → boundary de 2 palavras, 7 e 2
 *
 * Ou seja: o motor trata o pronome enclítico como parte da MESMA palavra,
 * aplica a tonicidade de "preparese" e sai a sílaba errada. Separar devolve
 * duas palavras e cada uma sai correta.
 *
 * O conjunto de pronomes é FECHADO em português, e é por isso que a troca é
 * segura: `BR-153` não casa (dígitos), `Anhanguera-Norte` não casa
 * (maiúscula), e um nome de rua com hífen comum também não. Só verbo seguido
 * de pronome átono.
 *
 * Aplicado no ponto de FALA, e não em quem monta a frase, porque boa parte do
 * texto vem pronta do provedor de rota. E não é hipótese: varrendo as frases
 * reais de um trajeto, VINTE delas usam "Mantenha-se à direita/esquerda" — o
 * mesmo padrão, em toda instrução de manter-se na faixa.
 *
 * `-o`, `-a`, `-os`, `-as` ficaram DE FORA de propósito. São enclíticos
 * legítimos, mas colidem com nome próprio: "Trás-os-Montes" viraria "Trás os
 * Montes". Como nenhuma instrução de navegação os usa, o risco não compensa.
 */
/*
  Alternancia do MAIS LONGO para o mais curto e limite de palavra no fim, os
  dois obrigatorios: sem a ordem, `lhe` casaria dentro de `lhes` e sobraria um
  "s" solto; sem o limite, `-la` casaria em `-lado` e `-no` em
  `Anhanguera-Norte`, quebrando nome de rua.
*/
const ENCLITIC = /([a-záàâãéêíóôõúç])-(lhes|lhe|los|las|nos|vos|se|me|te|lo|la)\b/gi

export function speakableText(text: string): string {
  return (
    text
      .replace(ENCLITIC, '$1 $2')
      // Espaços repetidos viram pausa audível em alguns motores.
      .replace(/\s{2,}/g, ' ')
      .trim()
  )
}

/**
 * Vozes em português disponíveis NO DISPOSITIVO — a lista real, nunca inventada.
 *
 * DEDUPLICADA e ORDENADA. O `getVoices()` pode devolver a mesma voz mais de
 * uma vez (observado em navegadores que agregam mais de um mecanismo), e a
 * ordem em que ela chega é a do sistema, não uma que ajude a escolher. Aqui:
 * pt-BR antes de pt-PT — o produto é brasileiro e uma voz de Portugal lê
 * "vire à direita" com outra prosódia —, voz do aparelho antes de voz online
 * (a online falha sem rede, no meio do trânsito), e nome como desempate.
 */
export function listPortugueseVoices(): SpeechSynthesisVoice[] {
  if (!isSpeechSupported) return []

  const porUri = new Map<string, SpeechSynthesisVoice>()
  for (const voice of window.speechSynthesis.getVoices()) {
    if (!voice.lang.toLowerCase().startsWith('pt')) continue
    if (!porUri.has(voice.voiceURI)) porUri.set(voice.voiceURI, voice)
  }

  return [...porUri.values()].sort((a, b) => {
    const brA = a.lang.toLowerCase().startsWith('pt-br') ? 0 : 1
    const brB = b.lang.toLowerCase().startsWith('pt-br') ? 0 : 1
    if (brA !== brB) return brA - brB
    if (a.localService !== b.localService) return a.localService ? -1 : 1
    return a.name.localeCompare(b.name, 'pt-BR')
  })
}

/**
 * Rótulo da voz na interface.
 *
 * O nome do sistema NÃO é único: no iOS a mesma voz aparece em versão
 * compacta, aprimorada e premium, as três chamadas "Luciana" — foi o que o
 * usuário viu como opções repetidas. Aqui o nome ganha um qualificador só
 * QUANDO ele se repete na lista, para não poluir o caso comum.
 *
 * O qualificador sai do `voiceURI`, que é onde a distinção realmente está
 * (`com.apple.voice.compact.pt-BR.Luciana`), com o locale como segunda opção
 * e um índice como último recurso — nunca "Voz 2" quando dá para dizer
 * "Aprimorada".
 */
export function describeVoice(voice: SpeechSynthesisVoice, all: SpeechSynthesisVoice[]): string {
  const homonimos = all.filter((entry) => entry.name === voice.name)
  if (homonimos.length <= 1) return voice.name

  const uri = voice.voiceURI.toLowerCase()
  const qualidade =
    uri.includes('premium') || uri.includes('siri')
      ? 'premium'
      : uri.includes('enhanced')
        ? 'aprimorada'
        : uri.includes('compact')
          ? 'compacta'
          : null

  if (qualidade) return `${voice.name} · ${qualidade}`

  // Sem pista de qualidade: o locale distingue pt-BR de pt-PT.
  const outros = homonimos.filter((entry) => entry.lang !== voice.lang)
  if (outros.length > 0) return `${voice.name} · ${voice.lang}`

  return `${voice.name} · ${homonimos.indexOf(voice) + 1}`
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

  // Normaliza AQUI: é o último ponto antes do motor, então nada escapa —
  // inclusive o texto que veio pronto do provedor de rota.
  const utterance = new SpeechSynthesisUtterance(speakableText(item.text))
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
