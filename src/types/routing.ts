import type { LngLat } from '@/config/region'

/**
 * Classificação estrutural de vias, alinhada à hierarquia usada por
 * provedores baseados em OpenStreetMap (equivalente às tags `highway=*`).
 * A camada de integração com o provedor (services/routing/provider.ts) e a
 * camada de enriquecimento (services/routing/segmentEnrichment.ts) são
 * responsáveis por preencher este valor — nenhuma outra camada deve conhecer
 * o formato específico do provedor de rota ou do OpenStreetMap.
 */
export type RoadClass =
  | 'motorway'
  | 'trunk'
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'residential'
  | 'service'
  | 'unknown'

/**
 * Nível de adequação de um trecho de via para o perfil autopropelido —
 * a saída da camada "scooter suitability" (services/routing/roadClassification.ts).
 * 'prohibited' só deve ser atribuído a partir de um sinal explícito e
 * confiável (ex: tag `access=no/private` do OSM) — nunca inventado.
 */
export type SuitabilityTier = 'very-good' | 'good' | 'caution' | 'unsuitable' | 'prohibited'

/**
 * Elegibilidade (permitida vs. proibida) é um eixo DIFERENTE de qualidade
 * (SuitabilityTier/suitabilityScore). Uma via pode ser 'allowed' e ainda
 * pontuar mal (ex: avenida permitida, mas com tráfego pesado); só vira
 * 'not-allowed' com sinal explícito e confiável (ex: tag OSM `access=no`) —
 * nunca inferido do nome da via. 'discouraged' cobre o meio-termo: utilizável,
 * mas o produto desaconselha (ex: vias rápidas/rodovias) sem alegar restrição legal.
 */
export type Eligibility = 'allowed' | 'discouraged' | 'not-allowed'

export interface TierBreakdownEntry {
  tier: SuitabilityTier
  distanceMeters: number
}

/**
 * Subconjunto das tags do OpenStreetMap relevantes para avaliar a adequação
 * de uma via ao scooter. Preenchida pela camada de enriquecimento
 * (Overpass); nenhuma tag é garantida — sempre trate como opcional.
 */
export interface OsmWayTags {
  highway?: string
  ref?: string
  name?: string
  maxspeed?: string
  motorroad?: string
  lanes?: string
  oneway?: string
  surface?: string
  access?: string
  /** `bicycle=yes/designated/no` — sinal mais próximo de "compatível com scooter" que existe no OSM hoje. */
  bicycle?: string
  /** `foot=yes/no` — usado apenas como sinal auxiliar de via de baixa velocidade (ex: calçadão), não como regra primária. */
  foot?: string
}

export interface RouteSegment {
  /** Geometria do segmento (par de coordenadas ou mais, em ordem). */
  path: LngLat[]
  distanceMeters: number
  roadClass: RoadClass
  /** Nome da via, quando disponível — usado apenas como sinal auxiliar, nunca como regra primária. */
  roadName?: string
  /** Tags reais do OSM associadas a este segmento, quando o enriquecimento encontrou uma via correspondente. */
  osmTags?: OsmWayTags
}

/**
 * Tipo de manobra simplificado, derivado de `maneuver.type`/`maneuver.modifier`
 * do OSRM — usado pela UI de navegação para escolher ícone/texto. Preparado
 * para, futuramente, alimentar também orientação por voz.
 */
export type ManeuverType = 'depart' | 'turn-left' | 'turn-right' | 'straight' | 'roundabout' | 'arrive' | 'other'

export interface RouteStep {
  maneuver: ManeuverType
  /** Instrução legível, montada a partir dos dados estruturados do provedor (nunca inventada). */
  instruction: string
  /** Nome da via percorrida a partir desta manobra até a próxima. */
  roadName?: string
  /** Extensão deste passo (da manobra atual até a próxima), em metros. */
  distanceMeters: number
  /** Ponto onde a manobra ocorre. */
  point: LngLat
  /** Distância acumulada desde o início da rota até este ponto de manobra. */
  cumulativeDistanceMeters: number
}

export interface CandidateRoute {
  id: string
  segments: RouteSegment[]
  totalDistanceMeters: number
  /** Geometria completa, para renderização no mapa. */
  geometry: LngLat[]
  /** Passos de navegação turn-by-turn, na ordem da rota — vazio se o provedor não retornar `steps`. */
  steps: RouteStep[]
}

export interface RouteSuitabilityIssue {
  /** Índice do segmento de origem, quando aplicável (agregações por tier não referenciam um único segmento). */
  segmentIndex?: number
  reason: string
  severity: 'blocking' | 'warning'
}

export type RouteRecommendationLabel = 'recommended' | 'fastest' | 'safest'

export interface ScoredRoute {
  route: CandidateRoute
  /** 0 (inadequada) a 100 (ideal para o perfil autopropelido) — QUALIDADE, não permissão. */
  suitabilityScore: number
  /** Permissão/elegibilidade da rota como um todo — o pior valor entre os segmentos (ver Eligibility). Eixo separado de suitabilityScore. */
  eligibility: Eligibility
  issues: RouteSuitabilityIssue[]
  etaMinutes: number
  /** Distância agregada por nível de adequação — base da explicação "X km em via Y" na UI. */
  breakdown: TierBreakdownEntry[]
  /** Frases prontas para exibição (ex: "Recomendada para scooter — evita vias rápidas."). */
  highlights: string[]
  /** Rótulo desta rota dentro do conjunto de alternativas, quando aplicável. */
  label?: RouteRecommendationLabel
}

export interface RouteRequest {
  origin: LngLat
  destination: LngLat
}

export interface RouteResult {
  selected: ScoredRoute
  alternatives: ScoredRoute[]
}
