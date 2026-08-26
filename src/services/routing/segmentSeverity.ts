import { REASON_TEXT, type SuitabilityReasonCode } from '@/config/mobilityProfiles'
import { assessSegment, classifySegment, type VehicleClassificationContext } from '@/services/routing/roadClassification'
import { formatDistance } from '@/utils/geo'
import type { LngLat } from '@/config/region'
import type { CandidateRoute, SuitabilityTier } from '@/types/routing'

/**
 * Severidade de cada TRECHO da rota — a camada que transforma a classificação
 * de via em três níveis apresentáveis, no mapa e na explicação.
 *
 * Por que três e não os cinco níveis de SuitabilityTier: os cinco existem
 * para pontuar (`TIER_PENALTY_PER_KM`), onde granularidade ajuda. Para
 * COMUNICAR, cinco cores viram ruído — o usuário em movimento precisa de
 * "pode ir / preste atenção / isso aqui é ruim".
 *
 * A REGRA QUE MAIS IMPORTA AQUI é a duração do trecho, não só a classe da
 * via. Entrar 120 m numa BR para fazer um retorno e sair em seguida não é a
 * mesma coisa que percorrer 4 km de acostamento de rodovia, mesmo sendo
 * exatamente a mesma tag `ref=BR-153` nos dois casos. Uma cor só para os dois
 * seria informação errada. Por isso a severidade é calculada sobre TRECHOS
 * CONTÍNUOS (runs) de segmentos inadequados, e não segmento a segmento.
 */

export type SegmentSeverity = 'suitable' | 'attention' | 'critical'

/**
 * Até este comprimento, um trecho contínuo em via inadequada é tratado como
 * "atenção": é a travessia, o retorno, o acesso curto — manobras que o
 * roteamento não tem como evitar e que duram segundos.
 *
 * 400 m a 25–32 km/h é menos de um minuto de exposição. Acima disso deixa de
 * ser manobra e passa a ser percurso, e aí vira crítico.
 */
const SHORT_EXPOSURE_METERS = 400

/** Níveis que representam via inadequada para o veículo. */
const UNSUITABLE_TIERS: SuitabilityTier[] = ['unsuitable', 'prohibited']

export interface ClassifiedSegment {
  path: LngLat[]
  distanceMeters: number
  tier: SuitabilityTier
  severity: SegmentSeverity
  roadName?: string
  /** POR QUE este trecho recebeu esta classificação. Ver REASON_TEXT. */
  reason: SuitabilityReasonCode
}

export interface RouteSeverityBreakdown {
  suitableMeters: number
  attentionMeters: number
  criticalMeters: number
  totalMeters: number
}

export interface RouteSeverityAnalysis {
  /**
   * A classificação se apoia em dado real de via?
   *
   * false = o enriquecimento via Overpass não respondeu e nenhum segmento tem
   * tags do OSM. Nesse caso TODOS os trechos saem como 'suitable', mas por
   * ausência de informação, não por terem sido avaliados. A interface precisa
   * saber a diferença para não afirmar "todos os X km em vias adequadas"
   * quando o que aconteceu foi "não sabemos nada sobre estas vias".
   */
  isReliable: boolean
  segments: ClassifiedSegment[]
  breakdown: RouteSeverityBreakdown
  /**
   * Trechos contínuos que exigem atenção ou são críticos, já agregados —
   * base das frases de explicação ("120 m na BR-153 para acessar o retorno").
   */
  runs: SeverityRun[]
}

export interface SeverityRun {
  severity: Exclude<SegmentSeverity, 'suitable'>
  distanceMeters: number
  /** Nome da via mais longa dentro do trecho, quando conhecido. */
  roadName?: string
  segmentIndexes: number[]
  /**
   * Motivo DOMINANTE do trecho — o que responde por mais metros dentro dele.
   *
   * Um indicador vermelho sem contexto obriga o usuário a adivinhar se o
   * problema é a velocidade do tráfego, o tipo da via ou o piso. Aqui o
   * motivo viaja junto com a cor até a tela.
   */
  reason: SuitabilityReasonCode
}

export function analyzeRouteSeverity(
  route: CandidateRoute,
  vehicle?: VehicleClassificationContext,
  isReliable = true,
): RouteSeverityAnalysis {
  const assessments = route.segments.map((segment) => assessSegment(segment, vehicle))
  const tiers = assessments.map((entry) => entry.tier)

  // 1. Agrupa segmentos contíguos que caem em via inadequada. É o
  //    comprimento do GRUPO que decide a severidade, não o do segmento —
  //    um provedor pode partir 300 m de rodovia em seis segmentos de 50 m, e
  //    avaliá-los isoladamente faria seis "trechos curtos" inofensivos.
  const severities: SegmentSeverity[] = tiers.map((tier) => (tier === 'caution' ? 'attention' : 'suitable'))
  const runs: SeverityRun[] = []

  let index = 0
  while (index < route.segments.length) {
    if (!UNSUITABLE_TIERS.includes(tiers[index])) {
      index += 1
      continue
    }

    const start = index
    let runMeters = 0
    while (index < route.segments.length && UNSUITABLE_TIERS.includes(tiers[index])) {
      runMeters += route.segments[index].distanceMeters
      index += 1
    }

    const severity: Exclude<SegmentSeverity, 'suitable'> =
      runMeters <= SHORT_EXPOSURE_METERS ? 'attention' : 'critical'

    const segmentIndexes: number[] = []
    for (let i = start; i < index; i += 1) {
      severities[i] = severity
      segmentIndexes.push(i)
    }

    // Motivo dominante: o que responde por mais metros dentro do trecho.
    const metersByReason = new Map<SuitabilityReasonCode, number>()
    for (const i of segmentIndexes) {
      const key = assessments[i].reason
      metersByReason.set(key, (metersByReason.get(key) ?? 0) + route.segments[i].distanceMeters)
    }
    const dominantReason =
      [...metersByReason.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? assessments[start].reason

    runs.push({
      severity,
      reason: dominantReason,
      distanceMeters: runMeters,
      roadName: dominantRoadName(route, segmentIndexes),
      segmentIndexes,
    })
  }

  // 2. Trechos de atenção contíguos também viram runs, para a explicação.
  index = 0
  while (index < route.segments.length) {
    if (severities[index] !== 'attention' || tiers[index] !== 'caution') {
      index += 1
      continue
    }
    const start = index
    let runMeters = 0
    while (index < route.segments.length && severities[index] === 'attention' && tiers[index] === 'caution') {
      runMeters += route.segments[index].distanceMeters
      index += 1
    }
    const segmentIndexes: number[] = []
    for (let i = start; i < index; i += 1) segmentIndexes.push(i)
    const porMotivo = new Map<SuitabilityReasonCode, number>()
    for (const i of segmentIndexes) {
      const key = assessments[i].reason
      porMotivo.set(key, (porMotivo.get(key) ?? 0) + route.segments[i].distanceMeters)
    }
    runs.push({
      severity: 'attention',
      reason: [...porMotivo.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? assessments[start].reason,
      distanceMeters: runMeters,
      roadName: dominantRoadName(route, segmentIndexes),
      segmentIndexes,
    })
  }

  const segments: ClassifiedSegment[] = route.segments.map((segment, i) => ({
    path: segment.path,
    distanceMeters: segment.distanceMeters,
    tier: tiers[i],
    severity: severities[i],
    roadName: segment.roadName,
    reason: assessments[i].reason,
  }))

  const breakdown = segments.reduce<RouteSeverityBreakdown>(
    (acc, segment) => {
      if (segment.severity === 'critical') acc.criticalMeters += segment.distanceMeters
      else if (segment.severity === 'attention') acc.attentionMeters += segment.distanceMeters
      else acc.suitableMeters += segment.distanceMeters
      acc.totalMeters += segment.distanceMeters
      return acc
    },
    { suitableMeters: 0, attentionMeters: 0, criticalMeters: 0, totalMeters: 0 },
  )

  runs.sort((a, b) => b.distanceMeters - a.distanceMeters)

  return { isReliable, segments, breakdown, runs }
}

/** Via que responde pela maior parte do trecho — evita citar uma travessa de 20 m como "a via" de um trecho de 300 m. */
function dominantRoadName(route: CandidateRoute, segmentIndexes: number[]): string | undefined {
  const byName = new Map<string, number>()
  for (const i of segmentIndexes) {
    const name = route.segments[i].roadName ?? route.segments[i].osmTags?.ref
    if (!name) continue
    byName.set(name, (byName.get(name) ?? 0) + route.segments[i].distanceMeters)
  }
  let best: string | undefined
  let bestMeters = 0
  for (const [name, meters] of byName) {
    if (meters > bestMeters) {
      best = name
      bestMeters = meters
    }
  }
  return best
}

/**
 * Frase de explicação de um trecho. Cita a via quando ela é conhecida —
 * "180 m na BR-153" é acionável; "180 m em via não recomendada" é abstrato.
 */
/**
 * Frase do trecho — agora com o MOTIVO.
 *
 * Antes dizia só "800 m na Avenida X em via não recomendada para o seu
 * veículo", o que deixa o usuário adivinhando: é o tipo da via? a velocidade
 * do tráfego? o piso? O motivo dominante do trecho responde isso em texto,
 * e não só em cor.
 */
/** Motivos que não acrescentam nada à frase — aí vale o texto genérico da severidade. */
const REASONLESS = new Set<SuitabilityReasonCode>(['no-data', 'urban-road', 'local-street'])

export function describeRun(run: SeverityRun): string {
  const distance = formatDistance(run.distanceMeters)
  const where = run.roadName ? ` na ${run.roadName}` : ''
  /**
   * O MOTIVO SUBSTITUI a frase genérica quando ele é mais informativo.
   *
   * Concatenar os dois produzia "exigem atenção — compartilhada com tráfego —
   * exige atenção": a mesma coisa dita duas vezes. Aqui o motivo é o predicado
   * da frase, e a severidade fica só na cor e no ícone, que já a comunicam.
   */
  const why = REASONLESS.has(run.reason)
    ? run.severity === 'critical'
      ? 'em via não recomendada para o seu veículo'
      : 'exigem atenção'
    : REASON_TEXT[run.reason].toLowerCase().replace(/ — exige atenção$/, '')
  return `${distance}${where}: ${why}.`
}

/**
 * Composição do trecho que AINDA FALTA, a partir da distância já percorrida.
 *
 * Existe porque durante a navegação a composição da rota inteira mente por
 * omissão: faltando 800 m de um percurso de 15 km, uma barra dizendo "1,2 km
 * em atenção" descreve algo que em grande parte já ficou para trás. O que
 * importa em movimento é o que vem pela frente.
 *
 * Segmentos parcialmente percorridos entram só com a fração restante — cortar
 * o segmento inteiro faria a barra pular a cada junção.
 */
export function remainingSeverity(
  analysis: RouteSeverityAnalysis,
  distanceTraveledMeters: number,
): RouteSeverityBreakdown {
  const breakdown: RouteSeverityBreakdown = {
    suitableMeters: 0,
    attentionMeters: 0,
    criticalMeters: 0,
    totalMeters: 0,
  }

  let cursor = 0
  for (const segment of analysis.segments) {
    const end = cursor + segment.distanceMeters
    cursor = end

    const remaining = Math.min(segment.distanceMeters, Math.max(0, end - distanceTraveledMeters))
    if (remaining <= 0) continue

    if (segment.severity === 'critical') breakdown.criticalMeters += remaining
    else if (segment.severity === 'attention') breakdown.attentionMeters += remaining
    else breakdown.suitableMeters += remaining
    breakdown.totalMeters += remaining
  }

  return breakdown
}
