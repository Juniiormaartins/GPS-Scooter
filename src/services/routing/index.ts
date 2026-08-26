import { calculateEtaMinutes, calculateRouteEtaMinutes } from '@/services/routing/eta'
import { getRoutingProvider } from '@/services/routing/provider'
import { enrichRouteSegments, prefetchWaysForRoutes } from '@/services/routing/segmentEnrichment'
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
import { mobilityProfile } from '@/config/mobilityProfiles'
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
        etaMinutes: calculateRouteEtaMinutes(enrichedRoute.segments, enrichedRoute.totalDistanceMeters, vehicle.modelId, vehicle.referenceSpeedKmh),
        highlights: [],
      }
    }),
  )

  const { ranked, recommendedId } = rankRoutes(scored)
  attachHighlights(ranked, recommendedId, mobilityProfile(vehicle.modelId).label.toLowerCase())

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
/**
 * Metros em via fortemente desaconselhada, a partir dos quais a rota é
 * considerada EXPOSTA.
 *
 * Não é zero de propósito: uma rota pode encostar 30 m numa marginal só para
 * fazer a curva de entrada, e tratar isso como "rota perigosa" tiraria do
 * ranking rotas que são, na prática, boas. 150 m é um quarteirão — a partir
 * daí o usuário está de fato circulando ali.
 */
const EXPOSURE_THRESHOLD_METERS = 150

function exposureMeters(entry: ScoredRoute): number {
  return entry.breakdown
    .filter((item) => item.tier === 'unsuitable' || item.tier === 'prohibited')
    .reduce((sum, item) => sum + item.distanceMeters, 0)
}

/**
 * A rota atravessa algum trecho PROIBIDO?
 *
 * Proibido aqui é sinal explícito (`access=no/private`) ou impossibilidade
 * física (escada) — não é opinião de adequação. Encontrado em teste: para o
 * patinete, a candidata vinda da malha de pedestre cortava 90 m de uma via de
 * serviço marcada como privada, e ela foi RECOMENDADA mesmo saindo do
 * pipeline com `eligibility: 'not-allowed'`. Recomendar uma rota que o
 * próprio app classifica como não permitida é contradizer a si mesmo.
 */
function hasProhibited(entry: ScoredRoute): boolean {
  return entry.breakdown.some((item) => item.tier === 'prohibited' && item.distanceMeters > 0)
}

function rankRoutes(scored: ScoredRoute[]): { ranked: ScoredRoute[]; recommendedId: string } {
  const tolerance = ROUTE_PREFERENCE_TOLERANCE[getUserPreferences().routePreference]

  /**
   * SEGURANÇA ANTES DE TEMPO — regra de ordenação, não desempate.
   *
   * O ranking anterior era `preferenceScore` e, entre as candidatas dentro de
   * uma tolerância, a mais CURTA vencia. O buraco: uma rota com um trecho de
   * rodovia podia ficar dentro da tolerância e, sendo mais curta, virar a
   * recomendada. Ou seja, a rota mais rápida com trecho perigoso ganhava da
   * rota segura mais lenta — exatamente o que não pode acontecer num app cujo
   * eixo é adequação.
   *
   * Agora a exposição a via fortemente desaconselhada é um PORTÃO: enquanto
   * existir ao menos uma candidata sem exposição relevante, nenhuma candidata
   * exposta pode ser recomendada, por mais rápida ou curta que seja. Só
   * quando TODAS estão expostas (acontece: às vezes não há caminho limpo) a
   * comparação volta a ser entre elas, aí sim pela menor exposição.
   *
   * A rota perigosa não some — continua na lista, marcada, e o usuário pode
   * escolhê-la conscientemente.
   */
  /**
   * DOIS PORTÕES, nesta ordem: proibido antes de desaconselhado.
   *
   * Sempre que existir candidata sem trecho proibido, só ela pode ser
   * recomendada. Depois, entre as permitidas, vale o portão de exposição a via
   * fortemente desaconselhada. Cada portão só cede quando NENHUMA candidata o
   * satisfaz — porque às vezes não há caminho limpo, e nesse caso é melhor
   * mostrar o menos ruim, marcado, do que não mostrar rota.
   */
  const allowed = scored.filter((entry) => !hasProhibited(entry))
  const permitted = allowed.length > 0 ? allowed : scored

  const clean = permitted.filter((entry) => exposureMeters(entry) < EXPOSURE_THRESHOLD_METERS)
  const pool = clean.length > 0 ? clean : permitted

  const maxScore = Math.max(...pool.map((entry) => entry.preferenceScore))
  const contenders = pool.filter((entry) => entry.preferenceScore >= maxScore - tolerance)
  const recommended = [...contenders].sort((a, b) => a.route.totalDistanceMeters - b.route.totalDistanceMeters)[0]

  // A mais rápida e a mais segura continuam sendo marcadas no conjunto INTEIRO
  // — inclusive quando a mais rápida é a exposta. É informação, e escondê-la
  // seria decidir pelo usuário em vez de informá-lo.
  const fastest = [...scored].sort((a, b) => a.etaMinutes - b.etaMinutes)[0]
  const safest = [...scored].sort((a, b) => b.suitabilityScore - a.suitabilityScore)[0]

  const ranked = [...scored].sort((a, b) => {
    // Rota com trecho proibido vai para o fim, antes de qualquer outro critério.
    const barredA = hasProhibited(a)
    const barredB = hasProhibited(b)
    if (barredA !== barredB) return barredA ? 1 : -1

    const exposedA = exposureMeters(a) >= EXPOSURE_THRESHOLD_METERS
    const exposedB = exposureMeters(b) >= EXPOSURE_THRESHOLD_METERS
    // Rotas expostas vão para o fim da lista, sempre.
    if (exposedA !== exposedB) return exposedA ? 1 : -1
    if (b.preferenceScore !== a.preferenceScore) return b.preferenceScore - a.preferenceScore
    return a.route.totalDistanceMeters - b.route.totalDistanceMeters
  })

  for (const entry of ranked) {
    entry.label = undefined
    if (entry.route.id === recommended.route.id) entry.label = 'recommended'
    else if (entry.route.id === fastest.route.id) entry.label = 'fastest'
    else if (entry.route.id === safest.route.id) entry.label = 'safest'
  }

  return { ranked, recommendedId: recommended.route.id }
}

/**
 * O nome do VEÍCULO no destaque, não "scooter" fixo.
 *
 * O texto dizia "Recomendada para scooter" mesmo com patinete ou bicicleta
 * elétrica selecionados — e desde que cada veículo passou a ter regras
 * próprias de via (ver mobilityProfiles), isso não é só uma palavra fora do
 * lugar: a recomendação foi calculada com as regras DAQUELE veículo, e nomear
 * outro faz o app parecer estar respondendo sobre outra coisa.
 */
function attachHighlights(routes: ScoredRoute[], recommendedId: string, vehicleLabel: string) {
  const recommended = routes.find((entry) => entry.route.id === recommendedId)
  if (!recommended) return

  for (const entry of routes) {
    const unsuitableDistance = entry.breakdown
      .filter((item) => item.tier === 'unsuitable' || item.tier === 'prohibited')
      .reduce((sum, item) => sum + item.distanceMeters, 0)

    const highlights: string[] = []

    if (entry.route.id === recommendedId) {
      if (unsuitableDistance === 0) {
        highlights.push(`Recomendada para ${vehicleLabel} — evita vias expressas e rodovias.`)
      } else {
        highlights.push(`Recomendada para ${vehicleLabel} — inclui ${formatDistance(unsuitableDistance)} de acesso inevitável em via inadequada.`)
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
      // O tempo é REFEITO aqui. `wayKind` só existe depois do enriquecimento,
      // então antes dele a conta era distância ÷ velocidade para tudo — e uma
      // rota por calçada saía com o tempo de quem passa por ela em via livre.
      etaMinutes: calculateRouteEtaMinutes(
        enrichedSegments,
        enrichedRoute.totalDistanceMeters,
        vehicle.modelId,
        vehicle.referenceSpeedKmh,
      ),
      severity: analyzeRouteSeverity(enrichedRoute, vehicle, true),
    }
  }

  /**
   * UMA consulta cobrindo todas as candidatas, antes de enriquecer qualquer uma.
   *
   * O `Promise.all` abaixo continua, mas agora ele não é mais N consultas
   * simultâneas: a área já está no cache e cada `upgrade` só faz o casamento
   * geométrico, que é local. Antes, cinco candidatas viravam cinco consultas
   * concorrentes contra um endpoint que aceita duas por IP — três eram
   * recusadas, e a rota ficava sem classificação por trecho.
   */
  await prefetchWaysForRoutes([result.selected.route, ...result.alternatives.map((entry) => entry.route)])

  const [selected, ...alternatives] = await Promise.all([
    upgrade(result.selected),
    ...result.alternatives.map(upgrade),
  ])

  const changed = selected !== result.selected || alternatives.some((entry, i) => entry !== result.alternatives[i])
  if (!changed) return null

  /**
   * REORDENA depois do enriquecimento.
   *
   * A exposição a via desaconselhada só é conhecida DEPOIS que as tags do OSM
   * chegam — antes disso quase tudo parece adequado. Sem reordenar aqui, a
   * regra de "segurança antes de tempo" ficaria valendo sobre dados que ainda
   * não existiam, e a rota que o enriquecimento revelou perigosa continuaria
   * em primeiro lugar.
   */
  const { ranked, recommendedId } = rankRoutes([selected, ...alternatives])
  attachHighlights(ranked, recommendedId, mobilityProfile(vehicle.modelId).label.toLowerCase())
  const upgradedSelected = ranked.find((entry) => entry.route.id === recommendedId) ?? selected
  return {
    selected: upgradedSelected,
    alternatives: ranked.filter((entry) => entry.route.id !== recommendedId),
  }
}

export { calculateEtaMinutes } from '@/services/routing/eta'
export { evaluateRoute } from '@/services/routing/ruleEngine'
