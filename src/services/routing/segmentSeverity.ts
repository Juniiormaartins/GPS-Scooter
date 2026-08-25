import { classifySegment, type VehicleClassificationContext } from '@/services/routing/roadClassification'
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
}

export function analyzeRouteSeverity(
  route: CandidateRoute,
  vehicle?: VehicleClassificationContext,
  isReliable = true,
): RouteSeverityAnalysis {
  const tiers = route.segments.map((segment) => classifySegment(segment, vehicle))

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

    runs.push({
      severity,
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
    runs.push({ severity: 'attention', distanceMeters: runMeters, roadName: dominantRoadName(route, segmentIndexes), segmentIndexes })
  }

  const segments: ClassifiedSegment[] = route.segments.map((segment, i) => ({
    path: segment.path,
    distanceMeters: segment.distanceMeters,
    tier: tiers[i],
    severity: severities[i],
    roadName: segment.roadName,
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
export function describeRun(run: SeverityRun): string {
  const distance = formatDistance(run.distanceMeters)
  const where = run.roadName ? ` na ${run.roadName}` : ''
  return run.severity === 'critical'
    ? `${distance}${where} em via não recomendada para o seu veículo.`
    : `${distance}${where} exigem atenção.`
}
