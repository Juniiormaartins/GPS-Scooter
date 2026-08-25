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

/**
 * Suavização ASSIMÉTRICA: a queda acompanha mais rápido que a subida.
 *
 * O relato de teste real foi preciso — num ônibus freando, o número ficava
 * parado em ~20 km/h e caía direto para 0. Duas causas, ambas aqui:
 *
 * 1. Um fator único de 0,35 para os dois sentidos. Vindo de 20 km/h, cada
 *    amostra só andava um terço do caminho, e a desaceleração inteira (uns 5
 *    segundos) cabia em poucas amostras — o número mal saía do lugar.
 * 2. O clamp de "parado" pulava a suavização e ia direto a zero, produzindo o
 *    degrau final.
 *
 * Frear é informação de segurança e é real; uma subida repentina é mais
 * provavelmente ruído. Daí a assimetria: 0,6 descendo, 0,35 subindo.
 */
const SMOOTHING_UP = 0.35
const SMOOTHING_DOWN = 0.6

/** Abaixo disso na tela, mostra 0: 1 km/h não é informação, é ruído residual. */
const DISPLAY_ZERO_BELOW_KMH = 1.5

/**
 * Variação máxima plausível de velocidade, em m/s².
 *
 * Um teto de velocidade ABSOLUTA não serve aqui: o usuário pode estar num
 * ônibus a 60 km/h, e isso é legítimo. O que não é legítimo é CHEGAR lá num
 * segundo. Uma leitura isolada de 60 km/h vinda de 18 empurrava a tela para 33
 * (medido) — não porque 60 seja impossível, mas porque a aceleração seria.
 *
 * 4 m/s² é aceleração vigorosa de automóvel; frear chega a 8 em situação de
 * emergência. Daí os dois limites serem diferentes: a física é assimétrica.
 */
const MAX_ACCELERATION_MPS2 = 4
const MAX_DECELERATION_MPS2 = 8

/** Sem amostra válida por mais que isso, a leitura anterior fica velha demais para continuar exibida. */
const STALE_AFTER_MS = 8000

export interface SpeedTrackerState {
  smoothedMps: number | null
  /**
   * Última leitura ACEITA, antes da suavização.
   *
   * O limite de aceleração precisa comparar com ela, não com o valor
   * suavizado: ancorar no suavizado faz a trava e a suavização brigarem, e o
   * atraso se acumula — medido, um ônibus acelerando de verdade até 60 km/h
   * (2,8 m/s², dentro do limite) só chegava a 34 na tela.
   */
  lastAcceptedMps: number | null
  lastSample: GeolocationSample | null
  lastValidAtMs: number | null
}

export const INITIAL_SPEED_STATE: SpeedTrackerState = {
  smoothedMps: null,
  lastAcceptedMps: null,
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
      lastAcceptedMps: isStale ? null : previous.lastAcceptedMps,
      lastSample: sample,
      lastValidAtMs: previous.lastValidAtMs,
    }
  }

  const rawMps = resolveRawSpeedMps(previous.lastSample, sample)
  if (rawMps == null) {
    return { ...previous, lastSample: sample }
  }

  // Parado é parado: exibir 2 km/h porque a posição tremeu é número falso.
  let clamped = rawMps < STATIONARY_THRESHOLD_MPS ? 0 : rawMps

  // Limite de aceleração: descarta o salto fisicamente impossível de uma
  // leitura espúria, sem impor teto de velocidade (ver MAX_ACCELERATION_MPS2).
  if (previous.lastAcceptedMps != null && previous.lastSample) {
    const elapsed = Math.max(0.5, Math.min(5, (sample.timestamp - previous.lastSample.timestamp) / 1000))
    const maxRise = previous.lastAcceptedMps + MAX_ACCELERATION_MPS2 * elapsed
    const maxFall = previous.lastAcceptedMps - MAX_DECELERATION_MPS2 * elapsed
    clamped = Math.min(maxRise, Math.max(maxFall, clamped))
  }

  // O zero NÃO pula mais a suavização. Antes ele ia direto ao destino, e era
  // isso que produzia o degrau de 20 para 0 sem passar pelo meio. Agora ele
  // desce pela mesma curva, só que pela rápida.
  const previousMps = previous.smoothedMps
  const factor = previousMps != null && clamped < previousMps ? SMOOTHING_DOWN : SMOOTHING_UP
  const smoothedMps = previousMps == null ? clamped : previousMps + factor * (clamped - previousMps)

  return { smoothedMps, lastAcceptedMps: clamped, lastSample: sample, lastValidAtMs: sample.timestamp }
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
  const kmh = state.smoothedMps * 3.6
  // A cauda da exponencial nunca chega a zero exato; sem este corte a tela
  // ficaria oscilando em 1 km/h com o veículo parado.
  return kmh < DISPLAY_ZERO_BELOW_KMH ? 0 : Math.round(kmh)
}
