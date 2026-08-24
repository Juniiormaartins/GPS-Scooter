import { classifyGrade, GRADE_LABEL, type RouteElevationProfile } from '@/services/routing/elevation'
import { classifySegment } from '@/services/routing/roadClassification'
import { formatDistance } from '@/utils/geo'
import type { AvoidanceId, UserPreferences } from '@/config/userPreferences'
import { AVOIDANCE_WEIGHT_BY_VEHICLE } from '@/config/userPreferences'
import type { CandidateRoute, RouteSegment } from '@/types/routing'

/**
 * Preferências do usuário sobre TIPOS DE VIA — o eixo "prefiro evitar",
 * deliberadamente separado do eixo "é permitido" (Eligibility) e do eixo "é
 * adequado ao veículo" (SuitabilityTier, no ruleEngine).
 *
 * A distinção que estrutura este arquivo:
 *
 * - REGRA OBRIGATÓRIA (ruleEngine + roadClassification): decorre do veículo e
 *   dos dados da via. O usuário não liga nem desliga. Uma via `access=no`
 *   continua proibida com todas as preferências desmarcadas.
 * - PREFERÊNCIA (aqui): o trecho PODE ser usado. Marcar a opção só faz a rota
 *   que passa por ele perder pontos no ranking, de forma proporcional à
 *   distância — nunca eliminá-la. Se todas as candidatas passarem pela
 *   condição, a melhor delas continua sendo oferecida, agora com o trecho
 *   sinalizado na tela.
 *
 * Consequência intencional: nenhuma preferência pode tornar o roteamento
 * impossível. O pior caso é uma rota recomendada com um aviso.
 */

/** Penalidade em pontos por quilômetro percorrido na condição evitada. */
const BASE_PENALTY_PER_KM: Record<AvoidanceId, number> = {
  'express-roads': 25,
  unpaved: 20,
  'steep-climbs': 18,
  'steep-descents': 12,
}

/**
 * Teto da penalidade total por preferência. Sem isso, uma rota longa onde a
 * condição é inevitável seria empurrada para score 0 e a UI passaria a
 * apresentar como "recomendada" uma alternativa absurdamente pior. O teto é o
 * que garante o comportamento pedido: evitar quando dá, aceitar quando não dá.
 */
const MAX_PENALTY_PER_AVOIDANCE = 30

export interface AvoidanceHit {
  id: AvoidanceId
  distanceMeters: number
  /** Segmentos onde a condição foi detectada — usados para destacar no mapa. */
  segmentIndexes: number[]
}

export interface AvoidanceEvaluation {
  hits: AvoidanceHit[]
  /** Pontos a subtrair do score de adequação da rota. */
  penaltyPoints: number
}

export function evaluateAvoidances(
  route: CandidateRoute,
  preferences: UserPreferences,
  elevation: RouteElevationProfile | null,
): AvoidanceEvaluation {
  const active = preferences.avoidances
  if (active.length === 0) return { hits: [], penaltyPoints: 0 }

  const hits: AvoidanceHit[] = []
  let penaltyPoints = 0

  for (const id of active) {
    const segmentIndexes: number[] = []
    let distanceMeters = 0

    route.segments.forEach((segment, index) => {
      if (!segmentMatchesAvoidance(id, segment, elevation?.gradeBySegment[index] ?? null)) return
      segmentIndexes.push(index)
      distanceMeters += segment.distanceMeters
    })

    if (segmentIndexes.length === 0) continue

    hits.push({ id, distanceMeters, segmentIndexes })

    // O peso depende do veículo: 6% de subida é um problema sério para um
    // patinete de roda pequena e quase irrelevante para uma bicicleta
    // elétrica com assistência — mesma condição detectada, pesos diferentes.
    const weight = AVOIDANCE_WEIGHT_BY_VEHICLE[preferences.vehicleModelId]?.[id] ?? 1
    const raw = (distanceMeters / 1000) * BASE_PENALTY_PER_KM[id] * weight
    penaltyPoints += Math.min(MAX_PENALTY_PER_AVOIDANCE, raw)
  }

  return { hits, penaltyPoints }
}

/**
 * Detecção por condição. Cada uma usa APENAS dado real; quando o dado não
 * existe para aquele segmento, a resposta é "não detectado" — nunca um chute.
 * Isso torna a detecção conservadora por construção: podemos deixar de
 * sinalizar um trecho, mas não sinalizamos um trecho que não conhecemos.
 */
function segmentMatchesAvoidance(id: AvoidanceId, segment: RouteSegment, gradePercent: number | null): boolean {
  switch (id) {
    case 'express-roads': {
      // Reaproveita a classificação que já existe: o que o produto considera
      // via expressa/rodovia é exatamente o que cai em 'unsuitable'.
      const tier = classifySegment(segment)
      return tier === 'unsuitable'
    }

    case 'unpaved':
      return isUnpavedSurface(segment.osmTags?.surface)

    case 'steep-climbs':
      return classifyGrade(gradePercent) === 'steep-climb'

    case 'steep-descents':
      return classifyGrade(gradePercent) === 'steep-descent'

    default:
      return false
  }
}

/**
 * Valores de `surface` do OSM que representam piso não pavimentado.
 *
 * Lista fechada e positiva de propósito: só marcamos "não pavimentada" quando
 * a tag diz isso. Ausência de tag NÃO é tratada como não pavimentada — e essa
 * decisão importa, porque a medição feita no centro de Goiânia mostrou que
 * apenas 41,9% das vias têm a tag `surface` preenchida (864 asphalt, 29
 * paved, 5 unpaved, 4 ground, 2 concrete, 1255 sem tag alguma, em 2159 vias).
 * Com essa cobertura não é possível afirmar "esta rota é 100% asfaltada" — só
 * "detectamos X metros de via não pavimentada".
 */
const UNPAVED_SURFACES = new Set([
  'unpaved',
  'gravel',
  'fine_gravel',
  'dirt',
  'earth',
  'ground',
  'sand',
  'mud',
  'grass',
  'compacted',
  'pebblestone',
  'woodchips',
])

export function isUnpavedSurface(surface: string | undefined): boolean {
  if (!surface) return false
  // A tag pode vir com múltiplos valores separados por ';'.
  return surface
    .toLowerCase()
    .split(';')
    .some((value) => UNPAVED_SURFACES.has(value.trim()))
}

export const AVOIDANCE_HIT_LABEL: Record<AvoidanceId, (distance: string) => string> = {
  'express-roads': (distance) => `${distance} em via expressa/rodovia que você pediu para evitar.`,
  unpaved: (distance) => `${distance} em via não pavimentada que você pediu para evitar.`,
  'steep-climbs': (distance) => `${distance} de ${GRADE_LABEL['steep-climb']} (estimada) que você pediu para evitar.`,
  'steep-descents': (distance) => `${distance} de ${GRADE_LABEL['steep-descent']} (estimada) que você pediu para evitar.`,
}

export function describeAvoidanceHit(hit: AvoidanceHit): string {
  return AVOIDANCE_HIT_LABEL[hit.id](formatDistance(hit.distanceMeters))
}
