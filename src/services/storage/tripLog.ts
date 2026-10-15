/**
 * VELOCIDADE REAL DE QUEM USA O APP — aprendida das viagens concluídas.
 *
 * POR QUE ISTO EXISTE. O ETA era distância ÷ velocidade de referência: 32 km/h
 * constantes. Esse número é a velocidade MÁXIMA do veículo, e ninguém a
 * mantém na cidade — semáforo, esquina, travessia e arrancada puxam a média
 * para baixo. Medido no Valhalla, em quatro trajetos de Goiânia, a média
 * estimada ficou entre 20 e 24 km/h para esta mesma classe de veículo. Sem
 * dado do próprio usuário não dá para dizer quem está certo; com ele, dá.
 *
 * O QUE É GUARDADO: distância percorrida e tempo decorrido de viagens que
 * chegaram ao destino. Tempo decorrido INCLUI as paradas — é de propósito,
 * porque o que o ETA precisa prever é o relógio, não o velocímetro.
 *
 * O QUE NÃO ENTRA, e é tão importante quanto o que entra:
 * - viagens SIMULADAS (partida manual). Elas andam exatamente na velocidade de
 *   referência e ensinariam ao app que a média é sempre o máximo;
 * - viagens curtas, onde a arrancada pesa demais e uma parada de semáforo vira
 *   30% do tempo;
 * - velocidades implausíveis para o veículo (GPS que pulou) ou muito baixas
 *   (usuário parou para um café com a navegação aberta).
 *
 * A MEDIANA, e não a média: uma viagem com parada longa não pode arrastar o
 * número de todas as outras.
 */

const STORAGE_KEY = 'gps-scooter:trip-log'
const MAX_RECORDS = 30

/** Abaixo disso a arrancada e o semáforo dominam — a viagem não representa o ritmo. */
export const MIN_TRIP_METERS = 1500
/** Viagens necessárias antes de o app confiar na própria média. */
export const MIN_TRIPS_TO_LEARN = 3
/** Média abaixo disto é pausa com a navegação aberta, não deslocamento. */
const MIN_PLAUSIBLE_KMH = 6

export interface TripRecord {
  distanceMeters: number
  elapsedSeconds: number
  /** Velocidade de referência vigente: viagens feitas com outra config não valem para esta. */
  referenceSpeedKmh: number
  at: number
}

function readAll(): TripRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as TripRecord[]) : []
  } catch {
    return []
  }
}

/** Devolve `true` se a viagem foi aceita como amostra. */
export function recordTrip(trip: Omit<TripRecord, 'at'>): boolean {
  if (trip.distanceMeters < MIN_TRIP_METERS || trip.elapsedSeconds <= 0) return false
  const avgKmh = (trip.distanceMeters / 1000) / (trip.elapsedSeconds / 3600)
  // Teto: um pouco acima da referência, para absorver ruído de GPS sem aceitar
  // um salto de posição como se fosse velocidade.
  if (avgKmh < MIN_PLAUSIBLE_KMH || avgKmh > trip.referenceSpeedKmh * 1.15) return false

  try {
    const next = [...readAll(), { ...trip, at: Date.now() }].slice(-MAX_RECORDS)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    return true
  } catch {
    return false
  }
}

export interface LearnedSpeed {
  kmh: number
  trips: number
}

/**
 * Média real do usuário com a configuração atual, ou `null` quando ainda não
 * há viagens suficientes — nesse caso quem chama usa a velocidade de
 * referência, como sempre usou.
 *
 * Nunca passa da referência: o veículo não anda mais rápido do que o que o
 * próprio usuário declarou, e uma mediana acima disso seria ruído.
 */
export function learnedSpeed(referenceSpeedKmh: number): LearnedSpeed | null {
  const speeds = readAll()
    .filter((trip) => trip.referenceSpeedKmh === referenceSpeedKmh)
    .map((trip) => (trip.distanceMeters / 1000) / (trip.elapsedSeconds / 3600))
    .sort((a, b) => a - b)
  if (speeds.length < MIN_TRIPS_TO_LEARN) return null

  const middle = Math.floor(speeds.length / 2)
  const median = speeds.length % 2 ? speeds[middle] : (speeds[middle - 1] + speeds[middle]) / 2
  return { kmh: Math.min(referenceSpeedKmh, median), trips: speeds.length }
}
