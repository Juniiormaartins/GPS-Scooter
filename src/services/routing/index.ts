import { calculateEtaMinutes } from '@/services/routing/eta'
import { getRoutingProvider } from '@/services/routing/provider'
import { enrichRouteSegments } from '@/services/routing/segmentEnrichment'
import { evaluateRoute } from '@/services/routing/ruleEngine'
import { describeAvoidanceHit, evaluateAvoidances } from '@/services/routing/avoidances'
import { fetchRouteElevationProfile } from '@/services/routing/elevation'
import { analyzeRouteSeverity } from '@/services/routing/segmentSeverity'
import type { VehicleClassificationContext } from '@/services/routing/roadClassification'
import {
  ELEVATION_DEPENDENT_AVOIDANCES,
  getUserPreferences,
  ROUTE_PREFERENCE_TOLERANCE,
} from '@/config/userPreferences'
import { formatDistance, formatEta } from '@/utils/geo'
import type { RouteRequest, RouteResult, ScoredRoute } from '@/types/routing'

/**
 * Orquestra o pipeline completo de roteamento:
 * 1. obter rotas candidatas do provedor (OSRM — services/routing/provider.ts);
 * 2. enriquecer os segmentos de cada candidata com dados reais do OSM
 *    (Overpass — services/routing/segmentEnrichment.ts);
 * 3. avaliar cada rota contra as regras do perfil autopropelido, com
 *    penalização proporcional por trecho (services/routing/ruleEngine.ts);
 * 4. calcular o ETA (32 km/h) de cada candidata;
 * 5. ranquear as alternativas e escolher a recomendada — não
 *    necessariamente a de maior pontuação isolada nem a mais rápida, mas a
 *    de melhor equilíbrio entre adequação e distância (ver `rankRoutes`);
 * 6. anexar explicações legíveis (highlights) e retornar rota selecionada +
 *    alternativas para o usuário.
 */
/**
 * Prazo do perfil de elevação. Assim como o enriquecimento, é OPCIONAL: sem
 * ele a rota existe e é exibida, apenas sem a dimensão de inclinação. Nunca
 * pode segurar a tela de "Calculando rota…".
 */
const ELEVATION_DEADLINE_MS = 6000

function withDeadline<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms)
    promise
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch(() => {
        clearTimeout(timer)
        resolve(fallback)
      })
  })
}

export async function planRoute(request: RouteRequest): Promise<RouteResult> {
  const provider = getRoutingProvider()
  const candidates = await provider.fetchCandidateRoutes(request)

  if (candidates.length === 0) {
    throw new Error('Nenhuma rota candidata foi encontrada entre a origem e o destino informados.')
  }

  const preferences = getUserPreferences()
  // O veículo do perfil passa a atravessar TODO o pipeline: a mesma via pode
  // ser adequada para uma scooter de 32 km/h e exigir atenção para um
  // patinete de 25 (ver applyVehicleAdjustment em roadClassification.ts).
  const vehicle: VehicleClassificationContext = {
    modelId: preferences.vehicleModelId,
    referenceSpeedKmh: preferences.referenceSpeedKmh,
  }

  // A elevação só é consultada quando alguma preferência realmente depende
  // dela. Sem isso, cada cálculo de rota disparava uma chamada de rede POR
  // CANDIDATA (cinco candidatas = cinco chamadas) para um perfil que nenhuma
  // outra parte do app lê — e o cálculo acontece bem mais do que parece: no
  // preview automático ao escolher um destino e em cada "buscar alternativa".
  const needsElevation = preferences.avoidances.some((id) => ELEVATION_DEPENDENT_AVOIDANCES.includes(id))

  const scored: ScoredRoute[] = await Promise.all(
    candidates.map(async (route) => {
      // Elevação continua com prazo: ela é opcional e rápida.
      // O ENRIQUECIMENTO NÃO ENTRA AQUI — ver `enrichRouteResult` abaixo.
      const elevation = needsElevation
        ? await withDeadline(fetchRouteElevationProfile(route), ELEVATION_DEADLINE_MS, null)
        : null
      const enrichedSegments = route.segments
      const enrichedRoute = { ...route, segments: enrichedSegments }
      const isEnriched = enrichedSegments.some((segment) => segment.osmTags != null)

      const { issues, suitabilityScore, eligibility, breakdown } = evaluateRoute(enrichedRoute, vehicle)

      // As preferências entram DEPOIS da avaliação obrigatória e só subtraem
      // pontos — não podem promover a elegibilidade de uma via inadequada.
      const avoidance = evaluateAvoidances(enrichedRoute, preferences, elevation)

      return {
        route: enrichedRoute,
        issues: [
          ...issues,
          ...avoidance.hits.map((hit) => ({ severity: 'warning' as const, reason: describeAvoidanceHit(hit) })),
        ],
        breakdown,
        suitabilityScore,
        /** Score já descontado das preferências — é ele que ordena o ranking. */
        preferenceScore: Math.max(0, suitabilityScore - avoidance.penaltyPoints),
        avoidanceHits: avoidance.hits,
        // null também quando nenhuma preferência de inclinação está ativa —
        // não é "falhou", é "não foi pedido" (ver needsElevation acima).
        elevation,
        severity: analyzeRouteSeverity(enrichedRoute, vehicle, isEnriched),
        eligibility,
        etaMinutes: calculateEtaMinutes(route.totalDistanceMeters),
        highlights: [],
      }
    }),
  )

  const { ranked, recommendedId } = rankRoutes(scored)
  attachHighlights(ranked, recommendedId)

  const selected = ranked.find((entry) => entry.route.id === recommendedId)!
  const alternatives = ranked.filter((entry) => entry.route.id !== recommendedId)

  return { selected, alternatives }
}

/**
 * Ranqueia as candidatas e decide qual é a "recomendada": a de maior
 * adequação, EXCETO quando outra candidata tem adequação muito próxima
 * (dentro de uma tolerância em pontos) e é significativamente mais curta —
 * nesse caso, a mais curta ganha, para evitar recomendar um desvio grande em
 * troca de um ganho de adequação irrisório.
 *
 * A tolerância vem da preferência do usuário (Perfil → "Estilo de rota"):
 * 'tranquil' é mais estrita (só aceita rotas muito próximas do máximo de
 * adequação), 'fast' é mais permissiva (aceita mais perda de adequação em
 * troca de velocidade). Nunca influencia a ELEGIBILIDADE das vias — só qual
 * das rotas já elegíveis é escolhida como recomendada.
 *
 * Rótulos 'fastest'/'safest' marcam os extremos do conjunto quando distintos
 * da recomendada, para a UI oferecer alternativas (ex: "Mais rápida").
 */
function rankRoutes(scored: ScoredRoute[]): { ranked: ScoredRoute[]; recommendedId: string } {
  const tolerance = ROUTE_PREFERENCE_TOLERANCE[getUserPreferences().routePreference]
  // Ranqueia pelo score JÁ descontado das preferências do usuário. Como o
  // desconto é limitado (ver MAX_PENALTY_PER_AVOIDANCE), uma condição
  // inevitável não elimina a rota: ela apenas perde posição e ganha aviso.
  const maxScore = Math.max(...scored.map((entry) => entry.preferenceScore))
  const contenders = scored.filter((entry) => entry.preferenceScore >= maxScore - tolerance)
  const recommended = [...contenders].sort((a, b) => a.route.totalDistanceMeters - b.route.totalDistanceMeters)[0]

  const fastest = [...scored].sort((a, b) => a.etaMinutes - b.etaMinutes)[0]
  const safest = [...scored].sort((a, b) => b.suitabilityScore - a.suitabilityScore)[0]

  const ranked = [...scored].sort((a, b) => b.preferenceScore - a.preferenceScore)

  for (const entry of ranked) {
    entry.label = undefined
    if (entry.route.id === recommended.route.id) entry.label = 'recommended'
    else if (entry.route.id === fastest.route.id) entry.label = 'fastest'
    else if (entry.route.id === safest.route.id) entry.label = 'safest'
  }

  return { ranked, recommendedId: recommended.route.id }
}

function attachHighlights(routes: ScoredRoute[], recommendedId: string) {
  const recommended = routes.find((entry) => entry.route.id === recommendedId)
  if (!recommended) return

  for (const entry of routes) {
    const unsuitableDistance = entry.breakdown
      .filter((item) => item.tier === 'unsuitable' || item.tier === 'prohibited')
      .reduce((sum, item) => sum + item.distanceMeters, 0)

    const highlights: string[] = []

    if (entry.route.id === recommendedId) {
      if (unsuitableDistance === 0) {
        highlights.push('Recomendada para scooter — evita vias expressas e rodovias.')
      } else {
        highlights.push(`Recomendada para scooter — inclui ${formatDistance(unsuitableDistance)} de acesso inevitável em via inadequada.`)
      }
    } else if (unsuitableDistance > 0 && recommended.route.id !== entry.route.id) {
      const extraTime = Math.round(entry.etaMinutes - recommended.etaMinutes)
      if (extraTime < 0) {
        highlights.push(`Mais rápida (${formatEta(entry.etaMinutes)}), mas passa por ${formatDistance(unsuitableDistance)} de via inadequada.`)
      } else {
        highlights.push(`⚠️ Esta rota utiliza ${formatDistance(unsuitableDistance)} de via expressa/rodovia.`)
      }
    } else if (unsuitableDistance === 0 && entry.etaMinutes > recommended.etaMinutes) {
      const extraTime = Math.round(entry.etaMinutes - recommended.etaMinutes)
      if (extraTime > 0) {
        highlights.push(`${extraTime} min mais longa que a recomendada, mas igualmente adequada.`)
      }
    }

    entry.highlights = highlights
  }
}

/**
 * Enriquece uma rota JÁ ENTREGUE e devolve a versão classificada.
 *
 * POR QUE ISTO EXISTE. Antes o enriquecimento corria contra um prazo dentro do
 * `planRoute`: se o Overpass demorasse mais que o prazo, o resultado era
 * DESCARTADO e a rota ficava sem classificação nenhuma. Medido em execução: a
 * consulta trouxe 3.511 vias com tags completas, mas o cálculo total levou
 * 15,7 s contra um prazo de 15 s — o dado chegou e foi jogado fora. Era essa a
 * razão de os trechos não recomendados nunca aparecerem destacados.
 *
 * Correr contra prazo é o mecanismo errado para este dado. A rota precisa
 * aparecer rápido; a CLASSIFICAÇÃO dela pode chegar alguns segundos depois e
 * atualizar as cores. Agora é isso: `planRoute` entrega em segundos, e quem
 * chamou pede o upgrade quando quiser.
 *
 * Devolve `null` quando não há nada a acrescentar — aí o chamador nem precisa
 * re-renderizar.
 */
export async function enrichRouteResult(result: RouteResult): Promise<RouteResult | null> {
  const preferences = getUserPreferences()
  const vehicle: VehicleClassificationContext = {
    modelId: preferences.vehicleModelId,
    referenceSpeedKmh: preferences.referenceSpeedKmh,
  }

  const upgrade = async (scored: ScoredRoute): Promise<ScoredRoute> => {
    // Já classificado (rota reaproveitada do preview): não refaz.
    if (scored.severity.isReliable) return scored

    const enrichedSegments = await enrichRouteSegments(scored.route)
    if (!enrichedSegments.some((segment) => segment.osmTags != null)) return scored

    const enrichedRoute = { ...scored.route, segments: enrichedSegments }
    const { issues, suitabilityScore, eligibility, breakdown } = evaluateRoute(enrichedRoute, vehicle)
    const avoidance = evaluateAvoidances(enrichedRoute, preferences, scored.elevation)

    return {
      ...scored,
      route: enrichedRoute,
      issues: [
        ...issues,
        ...avoidance.hits.map((hit) => ({ severity: 'warning' as const, reason: describeAvoidanceHit(hit) })),
      ],
      breakdown,
      suitabilityScore,
      preferenceScore: Math.max(0, suitabilityScore - avoidance.penaltyPoints),
      avoidanceHits: avoidance.hits,
      eligibility,
      severity: analyzeRouteSeverity(enrichedRoute, vehicle, true),
    }
  }

  const [selected, ...alternatives] = await Promise.all([
    upgrade(result.selected),
    ...result.alternatives.map(upgrade),
  ])

  const changed = selected !== result.selected || alternatives.some((entry, i) => entry !== result.alternatives[i])
  return changed ? { selected, alternatives } : null
}

export { calculateEtaMinutes } from '@/services/routing/eta'
export { evaluateRoute } from '@/services/routing/ruleEngine'
