import { haversineDistanceMeters } from '@/utils/geo'
import type { GeolocationSample } from '@/hooks/useGeolocation'

/**
 * Velocidade de deslocamento exibida durante a navegação.
 *
 * AUDITORIA (motivada por relato de teste de rua: "sacudir o celular parecia
 * mudar a velocidade"). O que foi verificado no código:
 *
 * - Não existe, e nunca existiu, qualquer uso de DeviceMotion, acelerômetro
 *   ou giroscópio neste projeto (`grep` por DeviceMotion/accelerometer/
 *   Gyroscope não retorna nada). A velocidade sempre veio de
 *   `GeolocationPosition.coords.speed`. Então o aparelho não alimenta a
 *   velocidade por sensor inercial.
 *
 * - MAS o relato tem uma causa real. `coords.speed` não é sempre Doppler do
 *   GNSS: no Android, o valor vem do provedor fundido do sistema, e em
 *   vários navegadores ele é DERIVADO da diferença entre posições
 *   consecutivas. Como a posição tem ruído de alguns metros e oscila mesmo
 *   com o aparelho parado, mexer no celular (ou só ficar parado com sinal
 *   ruim) produz deslocamento aparente — e portanto velocidade aparente.
 *   Antes desta revisão o valor bruto ia direto para a tela, arredondado,
 *   sem nenhum tratamento: qualquer ruído aparecia como km/h.
 *
 * O que este módulo faz, deliberadamente simples:
 * 1. usa a velocidade do GPS quando ela existe (é a melhor fonte);
 * 2. descarta amostras com precisão ruim, em vez de exibir número inventado;
 * 3. zera quando o deslocamento é menor que a própria incerteza da posição —
 *    ou seja, quando não há prova de que o usuário saiu do lugar;
 * 4. suaviza levemente para a tela não piscar a cada tick;
 * 5. devolve `null` (a UI mostra "—") quando não dá para afirmar nada.
 *
 * O que NÃO faz: inventar velocidade a partir do veículo configurado, ou
 * "corrigir" o valor para parecer plausível.
 */

/** Acima disso a posição é imprecisa demais para derivar velocidade confiável. */
const MAX_USABLE_ACCURACY_METERS = 35

/** Abaixo disso, tratamos como parado: é ruído de GPS, não deslocamento. */
const STATIONARY_THRESHOLD_MPS = 0.7 // ≈ 2,5 km/h

/** Acima disso é claramente erro de leitura para os veículos deste app. */
const IMPLAUSIBLE_SPEED_MPS = 33 // ≈ 120 km/h

/** Peso da amostra nova na média exponencial. Baixo = mais estável, alto = mais reativo. */
const SMOOTHING_FACTOR = 0.35

/** Sem amostra válida por mais que isso, a leitura anterior fica velha demais para continuar exibida. */
const STALE_AFTER_MS = 8000

export interface SpeedTrackerState {
  smoothedMps: number | null
  lastSample: GeolocationSample | null
  lastValidAtMs: number | null
}

export const INITIAL_SPEED_STATE: SpeedTrackerState = {
  smoothedMps: null,
  lastSample: null,
  lastValidAtMs: null,
}

/**
 * Função pura: recebe o estado anterior e a amostra nova, devolve o estado
 * novo. Sem efeito colateral e sem depender de React, então é testável
 * isoladamente e o mesmo cálculo serve para uma trilha gravada.
 */
export function trackSpeed(previous: SpeedTrackerState, sample: GeolocationSample): SpeedTrackerState {
  // Precisão ruim: não afirmar velocidade nenhuma. Mantém a leitura anterior
  // por alguns segundos (sinal costuma voltar) e depois desiste.
  if (sample.accuracyMeters > MAX_USABLE_ACCURACY_METERS) {
    const isStale = previous.lastValidAtMs == null || sample.timestamp - previous.lastValidAtMs > STALE_AFTER_MS
    return {
      smoothedMps: isStale ? null : previous.smoothedMps,
      lastSample: sample,
      lastValidAtMs: previous.lastValidAtMs,
    }
  }

  const rawMps = resolveRawSpeedMps(previous.lastSample, sample)
  if (rawMps == null) {
    return { ...previous, lastSample: sample }
  }

  // Parado é parado: exibir 2 km/h porque a posição tremeu é número falso.
  const clamped = rawMps < STATIONARY_THRESHOLD_MPS ? 0 : rawMps

  const smoothedMps =
    previous.smoothedMps == null || clamped === 0
      ? clamped
      : previous.smoothedMps + SMOOTHING_FACTOR * (clamped - previous.smoothedMps)

  return { smoothedMps, lastSample: sample, lastValidAtMs: sample.timestamp }
}

/**
 * Fonte da velocidade, em ordem de confiança:
 * 1. `coords.speed` do próprio GPS (quando o dispositivo fornece);
 * 2. deslocamento entre duas posições consecutivas — mas só quando o
 *    deslocamento supera a incerteza combinada das duas leituras, senão
 *    estaríamos medindo ruído.
 */
function resolveRawSpeedMps(previousSample: GeolocationSample | null, sample: GeolocationSample): number | null {
  if (sample.speedMps != null && Number.isFinite(sample.speedMps) && sample.speedMps >= 0) {
    return sample.speedMps > IMPLAUSIBLE_SPEED_MPS ? null : sample.speedMps
  }

  if (!previousSample) return null

  const elapsedSeconds = (sample.timestamp - previousSample.timestamp) / 1000
  // Intervalo curto demais amplifica o ruído; longo demais já não descreve "agora".
  if (elapsedSeconds < 1 || elapsedSeconds > 10) return null

  const movedMeters = haversineDistanceMeters(previousSample.position, sample.position)

  // O ponto central da correção: se o usuário "andou" menos do que a margem
  // de erro das próprias leituras, não houve deslocamento comprovado. É
  // exatamente o caso de mexer no celular parado.
  const noiseFloorMeters = Math.max(previousSample.accuracyMeters, sample.accuracyMeters)
  if (movedMeters <= noiseFloorMeters) return 0

  const derived = movedMeters / elapsedSeconds
  return derived > IMPLAUSIBLE_SPEED_MPS ? null : derived
}

/** Valor pronto para a tela, em km/h — `null` quando não há leitura confiável. */
export function speedKmhForDisplay(state: SpeedTrackerState): number | null {
  if (state.smoothedMps == null) return null
  return Math.round(state.smoothedMps * 3.6)
}
