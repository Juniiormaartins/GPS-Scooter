import { mobilityProfile } from '@/config/mobilityProfiles'
import type { UserPreferences } from '@/config/userPreferences'

/**
 * AUTONOMIA — a fonte única de "quanto o veículo ainda anda".
 *
 * Todo o resto do app (planejamento de rota, alerta de alcance, raio do modo
 * explorar) pergunta a este módulo, nunca à preferência crua. O motivo é que a
 * resposta honesta não é um número: é um número MAIS o quanto se pode confiar
 * nele, e essas duas coisas precisam viajar juntas ou a interface acaba
 * afirmando "28 km restantes" sobre um dado de três dias atrás.
 *
 * O QUE ESTE MÓDULO NÃO FAZ, e é deliberado: não lê o veículo. Não existe
 * integração de hardware nesta fase (o Bluetooth do app é do capacete/telemetria
 * simulada, não do controlador da bateria). Tudo aqui parte de um número que o
 * usuário informou, decaído pela distância percorrida desde então. Qualquer
 * consumidor deve apresentar o valor como ESTIMATIVA — nunca como leitura.
 */

/**
 * Consumo por quilômetro é linear sobre a autonomia de catálogo.
 *
 * Sabidamente simplificado: consumo real varia com relevo, peso, vento,
 * temperatura e estilo de condução, e nenhum desses dados existe aqui com
 * qualidade suficiente para entrar na conta. Um modelo linear erra de forma
 * PREVISÍVEL e explicável; um modelo elaborado sobre dados ruins erra de forma
 * imprevisível e ainda parece preciso. A margem de reserva abaixo é o que
 * absorve o erro.
 */
function percentPerKm(rangeKm: number): number {
  if (rangeKm <= 0) return 0
  return 100 / rangeKm
}

/**
 * Quanto se pode confiar no número informado, pelo tempo desde a informação.
 *
 * Não é o mesmo que "quanto tempo faz". Uma bateria informada há 3 h com o
 * veículo parado continua correta; informada há 3 h com 20 km rodados, não. Por
 * isso o decaimento por DISTÂNCIA é aplicado sempre (é o dado real que temos), e
 * a idade serve só para decidir o quanto a interface deve hesitar.
 */
export type BatteryConfidence = 'fresh' | 'aging' | 'stale' | 'unknown'

/** Até 6 h a estimativa é tratada como corrente. */
const FRESH_MS = 6 * 60 * 60 * 1000
/** Até 48 h ainda vale a pena mostrar, com ressalva explícita. */
const AGING_MS = 48 * 60 * 60 * 1000

function batteryConfidence(updatedAt: number | null, now = Date.now()): BatteryConfidence {
  if (updatedAt == null) return 'unknown'
  const age = now - updatedAt
  if (age < FRESH_MS) return 'fresh'
  if (age < AGING_MS) return 'aging'
  return 'stale'
}

export interface AutonomyState {
  /** Autonomia máxima do veículo configurado, em km. */
  rangeKm: number
  /** Porcentagem que o usuário informou da última vez. null = nunca informou. */
  informedPercent: number | null
  informedAt: number | null
  /** Metros rodados desde que informou — o que desconta da estimativa. */
  distanceSinceInformedMeters: number
  /** Porcentagem estimada AGORA. null quando nunca houve informação. */
  estimatedPercent: number | null
  /** Quilômetros que ainda dá para andar, estimados. null quando desconhecido. */
  remainingKm: number | null
  confidence: BatteryConfidence
  /** True quando a estimativa mudou desde o valor informado — a UI diz "estimado" em vez de repetir o número do usuário. */
  hasDecayed: boolean
}

export function autonomyState(preferences: UserPreferences, now = Date.now()): AutonomyState {
  const rangeKm = Math.max(0, preferences.rangeKm)
  const informedPercent = preferences.batteryPercent
  const informedAt = preferences.batteryUpdatedAt
  const distanceSinceInformedMeters = Math.max(0, preferences.batteryDistanceSinceUpdateMeters)

  if (informedPercent == null) {
    return {
      rangeKm,
      informedPercent: null,
      informedAt: null,
      distanceSinceInformedMeters,
      estimatedPercent: null,
      remainingKm: null,
      confidence: 'unknown',
      hasDecayed: false,
    }
  }

  const consumedPercent = (distanceSinceInformedMeters / 1000) * percentPerKm(rangeKm)
  const estimatedPercent = Math.max(0, Math.min(100, informedPercent - consumedPercent))

  return {
    rangeKm,
    informedPercent,
    informedAt,
    distanceSinceInformedMeters,
    estimatedPercent: Math.round(estimatedPercent),
    remainingKm: (estimatedPercent / 100) * rangeKm,
    confidence: batteryConfidence(informedAt, now),
    hasDecayed: consumedPercent >= 1,
  }
}

/**
 * RESERVA. A rota não pode consumir a autonomia inteira.
 *
 * 15% do alcance total, e não uma fração do trajeto: o que a reserva protege é
 * o erro do modelo linear e o "e se eu precisar desviar", e nenhum dos dois
 * encolhe só porque o trajeto é curto. Num veículo de 40 km isso são 6 km — a
 * ordem de grandeza de um retorno para casa.
 */
const RESERVE_FRACTION = 0.15

export type AutonomyVerdict =
  /** Cabe com folga sobre a reserva. */
  | 'comfortable'
  /** Cabe, mas come a reserva — dá para ir, convém saber. */
  | 'tight'
  /** A estimativa não cobre o trajeto. */
  | 'insufficient'
  /** Sem bateria informada: o app não finge saber. */
  | 'unknown'

export interface AutonomyAssessment {
  verdict: AutonomyVerdict
  routeKm: number
  remainingKm: number | null
  reserveKm: number
  /** Sobra depois do trajeto, já descontada a reserva. Negativo = invade a reserva. */
  marginKm: number | null
  confidence: BatteryConfidence
  /** Frase pronta, no vocabulário da interface. */
  message: string
}

export function assessRouteAutonomy(
  state: AutonomyState,
  routeDistanceMeters: number,
): AutonomyAssessment {
  const routeKm = routeDistanceMeters / 1000
  const reserveKm = state.rangeKm * RESERVE_FRACTION

  if (state.remainingKm == null) {
    return {
      verdict: 'unknown',
      routeKm,
      remainingKm: null,
      reserveKm,
      marginKm: null,
      confidence: 'unknown',
      message: 'Informe a bateria para saber se o trajeto cabe na autonomia.',
    }
  }

  const marginKm = state.remainingKm - routeKm - reserveKm

  if (state.remainingKm < routeKm) {
    return {
      verdict: 'insufficient',
      routeKm,
      remainingKm: state.remainingKm,
      reserveKm,
      marginKm,
      confidence: state.confidence,
      message: `Trajeto de ${formatKm(routeKm)} com ${formatKm(state.remainingKm)} estimados — pode não alcançar o destino.`,
    }
  }

  if (marginKm < 0) {
    return {
      verdict: 'tight',
      routeKm,
      remainingKm: state.remainingKm,
      reserveKm,
      marginKm,
      confidence: state.confidence,
      message: `Chega com pouca sobra: ${formatKm(state.remainingKm - routeKm)} depois de percorrer ${formatKm(routeKm)}.`,
    }
  }

  return {
    verdict: 'comfortable',
    routeKm,
    remainingKm: state.remainingKm,
    reserveKm,
    marginKm,
    confidence: state.confidence,
    message: `Autonomia suficiente: sobram cerca de ${formatKm(state.remainingKm - routeKm)}.`,
  }
}

/**
 * Raio que ainda dá para explorar — usado pelo modo de exploração e pelo
 * alcance mostrado na barra do veículo.
 *
 * IDA E VOLTA, não só ida. "Consigo explorar 12 km" que na verdade significa
 * "consigo ir 12 km e ficar lá" seria uma promessa falsa para quem está
 * decidindo onde passear. Metade do alcance útil, portanto.
 */
export function exploreRadiusKm(state: AutonomyState): number | null {
  if (state.remainingKm == null) return null
  const usable = state.remainingKm - state.rangeKm * RESERVE_FRACTION
  if (usable <= 0) return 0
  return usable / 2
}

function formatKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(km < 10 ? 1 : 0)} km`
}

/** Texto curto de ressalva pela idade do dado — null quando não há o que ressalvar. */
export function confidenceCaveat(confidence: BatteryConfidence): string | null {
  if (confidence === 'fresh') return null
  if (confidence === 'aging') return 'Estimativa baseada na última atualização.'
  if (confidence === 'stale') return 'Bateria informada há bastante tempo — vale conferir.'
  return 'Bateria não informada.'
}
