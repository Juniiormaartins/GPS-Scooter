/**
 * CHUVA — o único dado de clima que muda o que se faz sobre duas rodas.
 *
 * POR QUE SÓ CHUVA. Para um veículo de roda pequena, a diferença entre piso seco
 * e molhado é a maior de todas: aderência cai, a frenagem alonga, e faixa
 * pintada, tampa de bueiro e trilho viram gelo. Temperatura e vento mexem
 * pouco nessa conta; chuva muda tudo.
 *
 * FONTE: Open-Meteo, gratuita, sem chave, com CORS aberto — então roda direto do
 * navegador, sem backend. É PREVISÃO DE MODELO (grade de ~10 km no Brasil), não
 * radar: pode errar um bairro e pode errar por alguns minutos. Por isso toda
 * frase que sai daqui diz "a previsão indica", nunca "está chovendo" como fato
 * medido, e nenhuma decisão do app depende disto — só uma dica.
 *
 * FALHA EM SILÊNCIO, DE PROPÓSITO. Sem rede ou com a API fora, devolve `null` e
 * a dica simplesmente não existe. Inventar "sem chuva" por falta de dado seria
 * pior que calar.
 */

export interface RainOutlook {
  /** A previsão indica chuva neste exato momento, no lugar consultado. */
  raining: boolean
  /** Minutos até a próxima chuva prevista, ou `null` se não há chuva na janela. */
  minutesUntilRain: number | null
  fetchedAt: number
}

/** Acima disto, em 15 min, já é piso molhado — garoa fraca (~0,2 mm) inclusive. */
const WET_MM_PER_15MIN = 0.2

/** Códigos WMO de chuvisco, chuva, pancada e tempestade. */
const RAIN_WEATHER_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99])

const CACHE_TTL_MS = 10 * 60_000
const FETCH_TIMEOUT_MS = 8000

const cache = new Map<string, RainOutlook>()

interface OpenMeteoResponse {
  utc_offset_seconds?: number
  current?: { time: string; precipitation: number; weather_code: number }
  minutely_15?: { time: string[]; precipitation: (number | null)[] }
}

/**
 * Chave de cache em ~1 km. A previsão é de grade larga: dois pontos a 800 m um do
 * outro recebem exatamente a mesma resposta, e pedir de novo só gasta cota.
 */
function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(2)},${lng.toFixed(2)}`
}

export function interpretRain(data: OpenMeteoResponse, now: number): RainOutlook | null {
  const current = data.current
  const slots = data.minutely_15
  if (!current || !slots) return null

  const mmNow = current.precipitation ?? 0
  const raining = (mmNow >= 0.1 && RAIN_WEATHER_CODES.has(current.weather_code)) || mmNow >= 0.3

  let minutesUntilRain: number | null = null
  if (!raining) {
    const offsetMs = (data.utc_offset_seconds ?? 0) * 1000
    for (let i = 0; i < slots.time.length; i++) {
      const mm = slots.precipitation[i] ?? 0
      if (mm < WET_MM_PER_15MIN) continue
      // O horário vem no fuso local do ponto, sem sufixo: converte pelo offset
      // que a própria resposta informa, em vez de assumir o fuso do aparelho.
      const slotStart = Date.parse(`${slots.time[i]}:00Z`) - offsetMs
      const minutes = Math.round((slotStart - now) / 60000)
      if (minutes >= 0) {
        minutesUntilRain = Math.max(5, minutes)
        break
      }
    }
  }

  return { raining, minutesUntilRain, fetchedAt: now }
}

export async function fetchRainOutlook(lat: number, lng: number): Promise<RainOutlook | null> {
  const key = cacheKey(lat, lng)
  const hit = cache.get(key)
  if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) return hit

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}` +
    '&current=precipitation,weather_code&minutely_15=precipitation&forecast_minutely_15=6&timezone=auto'

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) return null
    const outlook = interpretRain((await response.json()) as OpenMeteoResponse, Date.now())
    if (outlook) cache.set(key, outlook)
    return outlook
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
