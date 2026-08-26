import { mobilityProfile } from '@/config/mobilityProfiles'
import type { ConsumptionSample, UserPreferences } from '@/config/userPreferences'

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

/**
 * AUTONOMIA APRENDIDA — a estimativa deixa de depender do catálogo.
 *
 * O catálogo é o número do fabricante em condição ideal: piloto leve, plano,
 * sem vento, bateria nova. Ninguém pilota em condição ideal, e a diferença
 * entre "40 km de catálogo" e os 26 km que a moto realmente faz é a diferença
 * entre chegar e empurrar.
 *
 * O app tem como medir isso sem falar com o veículo: entre duas informações de
 * bateria ele sabe quantos metros VIU o usuário percorrer e quantos pontos
 * percentuais caíram. Cada intervalo desses é uma medição de eficiência real.
 *
 * O QUE ISTO NÃO CONSERTA, e é honesto dizer: o modelo continua linear e
 * continua cego ao que acontece com o app fechado. Subida forte, vento e
 * pilotagem agressiva vão continuar gastando mais do que a conta prevê dentro
 * de um mesmo trajeto. O que muda é a BASE: em vez de partir de um número que
 * nunca foi verdade para este usuário, parte da média do que ele de fato faz.
 * Precisão em tempo real só existe com telemetria do controlador.
 */

/**
 * AUTONOMIA CORRIGIDA PELA VELOCIDADE — o caso do veículo destravado.
 *
 * O fabricante anuncia autonomia com o veículo na velocidade limitada de
 * fábrica. Destravado, o mesmo veículo não faz a mesma distância, e a diferença
 * é grande: a energia gasta por quilômetro tem uma parte que não depende da
 * velocidade (rolamento, transmissão, eletrônica) e uma parte de ARRASTO
 * AERODINÂMICO, que cresce com o QUADRADO dela. Dobrar a velocidade não dobra o
 * gasto — mais que dobra a parcela do arrasto.
 *
 *     energia por km ≈ 1 + k·v²
 *
 * O `k` aqui é uma PREMISSA DE PRODUTO, não uma medição deste veículo: foi
 * escolhido para que ir de 30 para 60 km/h corte a autonomia para cerca de
 * 55%, que é a ordem de grandeza relatada para veículos leves. Ele não sabe
 * nada sobre a carenagem, o peso ou a posição do piloto.
 *
 * POR QUE MESMO ASSIM VALE A PENA: a alternativa é repetir "120 km" para quem
 * destravou e anda a 60, o que é errado numa direção perigosa. Uma correção
 * aproximada para o lado certo é melhor que nenhuma correção.
 *
 * E ELA É TEMPORÁRIA: assim que houver amostras de consumo real
 * (`observedRangeKm`), a medição do próprio usuário passa a pesar mais que esta
 * conta — que existe justamente para o intervalo em que ainda não há medição
 * nenhuma.
 */
const DRAG_K = 4.04e-4

function energyPerKm(speedKmh: number): number {
  const v = Math.max(1, speedKmh)
  return 1 + DRAG_K * v * v
}

export function speedAdjustedRangeKm(preferences: UserPreferences): number {
  const catalogo = Math.max(0, preferences.rangeKm)
  const nominal = preferences.ratedSpeedKmh
  const real = preferences.referenceSpeedKmh
  if (!nominal || !real || nominal <= 0 || real <= 0) return catalogo

  // Andar MAIS DEVAGAR que o nominal também rende mais — a conta é simétrica.
  return catalogo * (energyPerKm(nominal) / energyPerKm(real))
}

/** Intervalo curto demais para medir eficiência: o erro do próprio percentual domina. */
const MIN_LEARN_METERS = 3000
/** Sem queda de bateria não há o que dividir; quedas de 1 ponto são ruído de arredondamento. */
const MIN_LEARN_PERCENT_DROP = 3

/**
 * Faixa de plausibilidade, como múltiplo da autonomia de catálogo.
 *
 * É a defesa contra o caso que o próprio usuário levantou: rodar com o app
 * FECHADO. Nesse intervalo o app viu 2 km e a bateria caiu 40% — o que daria
 * uma eficiência absurdamente ruim e envenenaria o modelo. Uma amostra fora de
 * [0,35× ; 2,5×] do catálogo é descartada em vez de aprendida: é muito mais
 * provável que o app tenha estado cego do que a moto ter mudado de física.
 */
const PLAUSIBLE_MIN_FACTOR = 0.35
const PLAUSIBLE_MAX_FACTOR = 2.5

/** Amostras guardadas. Poucas, e as mais recentes — bateria envelhece e o uso muda. */
const MAX_SAMPLES = 8

/**
 * Decide se um intervalo vira amostra. A maioria não vira, e isso é o desenho:
 * é melhor aprender devagar com dado bom do que rápido com dado ruim.
 */
export function buildConsumptionSample(
  meters: number,
  previousPercent: number,
  newPercent: number,
  catalogRangeKm: number,
): ConsumptionSample | null {
  const percentDrop = previousPercent - newPercent
  if (meters < MIN_LEARN_METERS) return null
  if (percentDrop < MIN_LEARN_PERCENT_DROP) return null

  const impliedRangeKm = (meters / 1000 / percentDrop) * 100
  if (catalogRangeKm > 0) {
    if (impliedRangeKm < catalogRangeKm * PLAUSIBLE_MIN_FACTOR) return null
    if (impliedRangeKm > catalogRangeKm * PLAUSIBLE_MAX_FACTOR) return null
  }

  return { meters, percentDrop, at: Date.now() }
}

export function appendConsumptionSample(
  samples: ConsumptionSample[],
  sample: ConsumptionSample,
): ConsumptionSample[] {
  return [sample, ...samples].slice(0, MAX_SAMPLES)
}

/**
 * Autonomia que as amostras indicam, em km. null enquanto não houver amostra.
 *
 * MEDIANA e não média: uma única saída atípica (um dia de serra, um dia de
 * vento) puxaria a média e mudaria a estimativa de todos os outros dias. A
 * mediana ignora o extremo sem precisar decidir o que é extremo.
 */
export function observedRangeKm(samples: ConsumptionSample[]): number | null {
  if (samples.length === 0) return null
  const valores = samples
    .map((sample) => (sample.meters / 1000 / sample.percentDrop) * 100)
    .sort((a, b) => a - b)
  const meio = Math.floor(valores.length / 2)
  return valores.length % 2 === 1 ? valores[meio] : (valores[meio - 1] + valores[meio]) / 2
}

export type RangeSource = 'catalog' | 'blend' | 'observed'

/**
 * A autonomia que o app usa de fato — mistura de catálogo e observação, com o
 * peso da observação crescendo com o número de amostras.
 *
 * NÃO SALTA para o valor observado na primeira amostra. Uma amostra é um dia; o
 * usuário veria a autonomia do app mudar de 40 para 26 km da noite para o dia
 * por causa de um único trajeto na chuva. A transição gradual chega no mesmo
 * lugar sem esse susto, e três amostras já pesam mais que o catálogo.
 */
export function effectiveRange(preferences: UserPreferences): { km: number; source: RangeSource; samples: number } {
  // O lado "catálogo" já vem corrigido pela velocidade real — senão um veículo
  // destravado partiria de um número que nunca foi verdade para ele.
  const catalogo = speedAdjustedRangeKm(preferences)
  const amostras = preferences.consumptionSamples ?? []
  const observado = observedRangeKm(amostras)

  if (observado == null) return { km: catalogo, source: 'catalog', samples: 0 }

  const peso = Math.min(1, amostras.length / 4)
  const km = catalogo * (1 - peso) + observado * peso
  return { km, source: peso >= 1 ? 'observed' : 'blend', samples: amostras.length }
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
  /** De onde saiu `rangeKm`: catálogo, mistura, ou o consumo observado deste usuário. */
  rangeSource: RangeSource
  /** Quantos intervalos reais já foram aprendidos. */
  rangeSamples: number
}

export function autonomyState(preferences: UserPreferences, now = Date.now()): AutonomyState {
  // A autonomia usada em TODA conta é a efetiva, não a de catálogo: é ela que
  // reflete o que este usuário realmente consegue.
  const efetiva = effectiveRange(preferences)
  const rangeKm = efetiva.km
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
      rangeSource: efetiva.source,
      rangeSamples: efetiva.samples,
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
    rangeSource: efetiva.source,
    rangeSamples: efetiva.samples,
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

/**
 * Ressalva pela IDADE do dado — null quando o dado é recente.
 *
 * Não confundir com a ressalva de ORIGEM ("o app não lê o veículo"), que vale
 * sempre e é responsabilidade de quem exibe o número. Esta aqui é sobre o
 * dado ter envelhecido; aquela é sobre ele nunca ter vindo do veículo.
 */
/**
 * De onde vem a autonomia — frase para a interface.
 *
 * Existe porque "40 km" e "26 km" dizem coisas diferentes conforme a origem, e
 * o usuário merece saber quando o número passou a ser DELE. É também o que
 * torna visível que o app está aprendendo, em vez de o número mudar sozinho
 * sem explicação.
 */
export function rangeSourceLabel(state: AutonomyState): string | null {
  if (state.rangeSource === 'catalog') return null
  if (state.rangeSource === 'blend') {
    return `Ajustando ao seu consumo real (${state.rangeSamples} ${state.rangeSamples === 1 ? 'trajeto medido' : 'trajetos medidos'}).`
  }
  return 'Autonomia calculada pelo seu consumo real, não pelo catálogo.'
}

export function confidenceCaveat(confidence: BatteryConfidence): string | null {
  if (confidence === 'fresh') return null
  if (confidence === 'aging') return 'Estimativa da última vez que você informou a bateria.'
  if (confidence === 'stale') return 'Bateria informada há bastante tempo — vale conferir antes de sair.'
  return 'Bateria não informada.'
}
