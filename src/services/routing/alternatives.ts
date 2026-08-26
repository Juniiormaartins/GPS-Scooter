import { projectPointOntoPath } from '@/utils/geo'
import type { LngLat } from '@/config/region'
import type { ScoredRoute } from '@/types/routing'

/**
 * Comparação entre a rota em uso e uma candidata, para a ação "buscar
 * alternativa" durante a navegação.
 *
 * A pergunta que este módulo responde não é "existe outra rota?" — o provedor
 * quase sempre devolve alguma coisa — mas "existe outra rota REALMENTE
 * DIFERENTE, e ela é melhor ou pior?". Oferecer uma alternativa que percorre
 * as mesmas ruas com 40 m a mais seria ruído no meio do trânsito.
 */

/**
 * Distância a partir da qual um ponto é considerado fora da rota atual.
 *
 * Generoso de propósito: duas rotas pela mesma avenida podem ter geometrias
 * levemente diferentes (faixa, retorno, ponto de encaixe do provedor) sem
 * serem caminhos distintos.
 */
const SAME_PATH_TOLERANCE_METERS = 40

/** Acima desta fração de sobreposição, é a mesma rota com outro nome. */
const SAME_ROUTE_OVERLAP = 0.85

/** Amostras usadas na comparação — suficiente para caracterizar o traçado sem varrer milhares de pontos. */
const COMPARISON_SAMPLES = 40

export interface RouteComparison {
  /** Percorre essencialmente o mesmo caminho? */
  isSamePath: boolean
  /** Fração da candidata que coincide com a rota atual (0–1). */
  overlap: number
  distanceDeltaMeters: number
  etaDeltaMinutes: number
  /** Diferença de adequação: positivo = a alternativa é mais adequada. */
  suitabilityDelta: number
  /** Diferença de metros em trecho crítico. Negativo = a alternativa expõe menos. */
  criticalDeltaMeters: number
  attentionDeltaMeters: number
}

export function compareRoutes(current: ScoredRoute, candidate: ScoredRoute): RouteComparison {
  const overlap = pathOverlap(candidate.route.geometry, current.route.geometry)

  return {
    overlap,
    isSamePath: overlap >= SAME_ROUTE_OVERLAP,
    distanceDeltaMeters: candidate.route.totalDistanceMeters - current.route.totalDistanceMeters,
    etaDeltaMinutes: candidate.etaMinutes - current.etaMinutes,
    suitabilityDelta: candidate.suitabilityScore - current.suitabilityScore,
    criticalDeltaMeters: candidate.severity.breakdown.criticalMeters - current.severity.breakdown.criticalMeters,
    attentionDeltaMeters: candidate.severity.breakdown.attentionMeters - current.severity.breakdown.attentionMeters,
  }
}

/**
 * Escolhe a melhor alternativa REALMENTE diferente entre as candidatas.
 *
 * Ordena por adequação (é o eixo que este app existe para otimizar) e, em
 * empate, pela mais curta. Devolve null quando todas repetem o caminho atual —
 * caso em que a interface avisa discretamente em vez de fingir uma opção.
 */
/**
 * Quantas alternativas a comparação mostra.
 *
 * O provedor devolve até cinco candidatas, mas comparar cinco cartões em
 * movimento não é comparar — é ler uma lista. Três (a atual mais duas) é o que
 * cabe na sheet sem rolagem e o que uma pessoa consegue pesar de relance.
 */
const MAX_ALTERNATIVES = 2

/**
 * TODAS as alternativas realmente diferentes, ordenadas.
 *
 * Existe porque a comparação passou a mostrar mais de uma: antes só a melhor
 * era oferecida, e o usuário não tinha como pesar "mais rápida com trecho
 * vermelho" contra "um pouco mais longa e limpa" — ele via uma opção e a
 * atual.
 *
 * A ordem é a mesma do ranking principal: adequação primeiro, distância como
 * desempate. Duas candidatas que percorrem o mesmo caminho não entram, e
 * candidatas iguais ENTRE SI também não — o provedor às vezes devolve duas
 * variações da mesma rua.
 */
export function pickAlternatives(
  current: ScoredRoute,
  candidates: ScoredRoute[],
  max = MAX_ALTERNATIVES,
): ScoredRoute[] {
  const distinct = candidates.filter((candidate) => !compareRoutes(current, candidate).isSamePath)

  const ordered = [...distinct].sort((a, b) => {
    if (b.preferenceScore !== a.preferenceScore) return b.preferenceScore - a.preferenceScore
    return a.route.totalDistanceMeters - b.route.totalDistanceMeters
  })

  const chosen: ScoredRoute[] = []
  for (const candidate of ordered) {
    if (chosen.length >= max) break
    // Distinta também das já escolhidas, senão a sheet mostra duas vezes o
    // mesmo caminho com nomes diferentes.
    if (chosen.some((entry) => compareRoutes(entry, candidate).isSamePath)) continue
    chosen.push(candidate)
  }
  return chosen
}

/** Fração dos pontos amostrados de `candidate` que caem sobre `reference`. */
function pathOverlap(candidate: LngLat[], reference: LngLat[]): number {
  if (candidate.length < 2 || reference.length < 2) return 0

  let onPath = 0
  let sampled = 0
  const stride = Math.max(1, Math.floor(candidate.length / COMPARISON_SAMPLES))

  for (let i = 0; i < candidate.length; i += stride) {
    sampled += 1
    const projection = projectPointOntoPath(candidate[i], reference)
    if (projection && projection.distanceFromPathMeters <= SAME_PATH_TOLERANCE_METERS) onPath += 1
  }

  return sampled === 0 ? 0 : onPath / sampled
}

/**
 * Frases que explicam a troca. Descrevem SEMPRE o que piora junto com o que
 * melhora — uma alternativa mais adequada quase sempre custa distância, e
 * esconder isso faria o usuário aceitar às cegas.
 */
export function describeComparison(comparison: RouteComparison): string[] {
  const lines: string[] = []

  const minutes = Math.round(comparison.etaDeltaMinutes)
  if (minutes > 0) lines.push(`${minutes} min a mais`)
  else if (minutes < 0) lines.push(`${Math.abs(minutes)} min a menos`)
  else lines.push('mesmo tempo estimado')

  const km = comparison.distanceDeltaMeters / 1000
  if (Math.abs(km) >= 0.1) {
    lines.push(`${km > 0 ? '+' : '−'}${Math.abs(km).toFixed(1)} km`)
  }

  if (comparison.criticalDeltaMeters <= -50) {
    lines.push(`${formatMeters(-comparison.criticalDeltaMeters)} a menos em via não recomendada`)
  } else if (comparison.criticalDeltaMeters >= 50) {
    lines.push(`${formatMeters(comparison.criticalDeltaMeters)} a mais em via não recomendada`)
  }

  if (comparison.attentionDeltaMeters <= -100) {
    lines.push(`${formatMeters(-comparison.attentionDeltaMeters)} a menos em trecho de atenção`)
  } else if (comparison.attentionDeltaMeters >= 100) {
    lines.push(`${formatMeters(comparison.attentionDeltaMeters)} a mais em trecho de atenção`)
  }

  return lines
}

function formatMeters(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`
}
