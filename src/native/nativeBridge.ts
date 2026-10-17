/**
 * Ponte com a casca Android (android-shell/). Só existe dentro do app instalado:
 * no navegador e no PWA `window.GpsScooterNative` é undefined e tudo aqui vira
 * "indisponível" — quem chama cai no comportamento de sempre.
 *
 * É uma interface injetada pela MainActivity (`addJavascriptInterface`), sem
 * biblioteca JavaScript e sem plugin do Capacitor: o site publicado não precisa
 * mudar de dependências para falar com o aparelho.
 *
 * O que ela dá, e por quê:
 * - VOZ das instruções: o WebView do Android não tem `speechSynthesis`, então a
 *   voz do GPS ficava muda ("Indisponível neste navegador"). Aqui fala o
 *   TextToSpeech do próprio Android.
 * - LOCALIZAÇÃO EM SEGUNDO PLANO: um serviço em primeiro plano (com aviso fixo na
 *   barra) continua lendo o GPS com a tela apagada ou com outro app na frente; as
 *   posições chegam por `window.__gpsNativeLocation`.
 * - BUSCA POR VOZ: abre o reconhecimento de fala do Android e devolve o texto por
 *   `window.__gpsNativeVoiceResult`.
 */

interface GpsScooterNative {
  speak(text: string, rate: number, urgent: boolean): void
  stopSpeaking(): void
  /** 'pronta' | 'iniciando' | 'sem-portugues' | 'falhou' */
  speechStatus(): string
  /** Devolve false se não pôde iniciar (sem permissão de localização, por exemplo). */
  startTracking(): boolean
  stopTracking(): void
  /** Devolve false se o aparelho não tem reconhecimento de fala. */
  startVoiceSearch(): boolean
}

declare global {
  interface Window {
    GpsScooterNative?: GpsScooterNative
    __gpsNativeLocation?: (lat: number, lng: number, accuracy: number, speed: number, heading: number, time: number) => void
    __gpsNativeVoiceResult?: (text: string | null) => void
  }
}

export const nativeBridge: GpsScooterNative | null =
  typeof window !== 'undefined' && window.GpsScooterNative ? window.GpsScooterNative : null

export interface NativeLocationSample {
  lat: number
  lng: number
  /** Metros; null quando o aparelho não informa. */
  accuracyMeters: number | null
  /** m/s; null quando o aparelho não informa. */
  speedMps: number | null
  headingDeg: number | null
  timestamp: number
}

const locationListeners = new Set<(sample: NativeLocationSample) => void>()

/** Recebe cada posição lida pelo serviço nativo. Devolve a função que cancela. */
export function subscribeNativeLocation(listener: (sample: NativeLocationSample) => void): () => void {
  locationListeners.add(listener)
  if (typeof window !== 'undefined') {
    window.__gpsNativeLocation = (lat, lng, accuracy, speed, heading, time) => {
      const sample: NativeLocationSample = {
        lat,
        lng,
        accuracyMeters: accuracy >= 0 ? accuracy : null,
        speedMps: speed >= 0 ? speed : null,
        headingDeg: heading >= 0 ? heading : null,
        timestamp: time,
      }
      locationListeners.forEach((fn) => fn(sample))
    }
  }
  return () => {
    locationListeners.delete(listener)
  }
}

/**
 * Abre a busca por voz do Android. `onResult` recebe o texto falado, ou null se a
 * pessoa cancelou. Devolve false se não deu para abrir — quem chama deve cair na
 * busca digitada.
 */
export function startNativeVoiceSearch(onResult: (text: string | null) => void): boolean {
  if (!nativeBridge) return false
  window.__gpsNativeVoiceResult = (text) => {
    window.__gpsNativeVoiceResult = undefined
    onResult(text && text.trim() ? text.trim() : null)
  }
  try {
    if (nativeBridge.startVoiceSearch()) return true
  } catch {
    // a ponte falhou: trata como indisponível
  }
  window.__gpsNativeVoiceResult = undefined
  return false
}

/** Texto para a tela de Perfil, a partir do estado do TextToSpeech do aparelho. */
export function describeNativeSpeechStatus(status: string): string {
  switch (status) {
    case 'pronta':
      return 'Voz do Android — toque para testar'
    case 'iniciando':
      return 'Voz do Android iniciando…'
    case 'sem-portugues':
      return 'Sem voz em português no aparelho'
    default:
      return 'Voz do Android indisponível'
  }
}
