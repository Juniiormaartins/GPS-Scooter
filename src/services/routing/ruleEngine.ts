import { classifySegment, TIER_ELIGIBILITY, TIER_LABEL, TIER_PENALTY_PER_KM } from '@/services/routing/roadClassification'
import { formatDistance } from '@/utils/geo'
import type { CandidateRoute, Eligibility, RouteSuitabilityIssue, SuitabilityTier, TierBreakdownEntry } from '@/types/routing'

/**
 * Camada de avaliação de adequação ao scooter ("scooter suitability").
 * Consome a classificação por segmento (roadClassification.ts) e produz DOIS
 * eixos deliberadamente separados (ver Eligibility em types/routing.ts):
 * - eligibility: a rota é PERMITIDA para o perfil? ('allowed'/'discouraged'/
 *   'not-allowed' — o pior valor entre os segmentos);
 * - suitabilityScore: o quão BOA ela é (0-100), por penalização proporcional
 *   à distância em cada nível — não uma proibição binária: um trecho curto e
 *   inevitável em via inadequada pesa pouco; uma rota majoritariamente em via
 *   inadequada é fortemente penalizada.
 * Também produz um resumo por nível (breakdown) e alertas (issues).
 */

const ELIGIBILITY_SEVERITY_RANK: Record<Eligibility, number> = {
  allowed: 0,
  discouraged: 1,
  'not-allowed': 2,
}

export interface RouteEvaluation {
  suitabilityScore: number
  eligibility: Eligibility
  breakdown: TierBreakdownEntry[]
  issues: RouteSuitabilityIssue[]
}

export function evaluateRoute(route: CandidateRoute): RouteEvaluation {
  if (route.totalDistanceMeters <= 0) {
    return { suitabilityScore: 0, eligibility: 'allowed', breakdown: [], issues: [] }
  }

  const distanceByTier = new Map<SuitabilityTier, number>()
  for (const segment of route.segments) {
    const tier = classifySegment(segment)
    distanceByTier.set(tier, (distanceByTier.get(tier) ?? 0) + segment.distanceMeters)
  }

  let penaltyPoints = 0
  let eligibility: Eligibility = 'allowed'
  const breakdown: TierBreakdownEntry[] = []
  for (const [tier, distanceMeters] of distanceByTier) {
    breakdown.push({ tier, distanceMeters })
    penaltyPoints += (distanceMeters / 1000) * TIER_PENALTY_PER_KM[tier]

    const tierEligibility = TIER_ELIGIBILITY[tier]
    if (ELIGIBILITY_SEVERITY_RANK[tierEligibility] > ELIGIBILITY_SEVERITY_RANK[eligibility]) {
      eligibility = tierEligibility
    }
  }
  breakdown.sort((a, b) => b.distanceMeters - a.distanceMeters)

  const suitabilityScore = Math.max(0, Math.min(100, Math.round(100 - penaltyPoints)))

  const issues: RouteSuitabilityIssue[] = breakdown
    .filter((entry) => entry.tier === 'caution' || entry.tier === 'unsuitable' || entry.tier === 'prohibited')
    .map((entry) => ({
      severity: entry.tier === 'caution' ? 'warning' : 'blocking',
      reason: `Esta rota utiliza ${formatDistance(entry.distanceMeters)} de ${TIER_LABEL[entry.tier]}.`,
    }))

  return { suitabilityScore, eligibility, breakdown, issues }
}
