import type { Eligibility, RoadClass, RouteSegment, SuitabilityTier } from '@/types/routing'

/**
 * Camada de classificação de vias ("scooter suitability"): traduz a
 * classificação estrutural de uma via (RoadClass + tags do OSM, quando o
 * enriquecimento via Overpass encontrou correspondência) em um nível de
 * adequação ao perfil autopropelido. Não decide pontuação nem faz
 * agregações de rota — isso é responsabilidade do ruleEngine.
 *
 * Prioridade dos sinais, do mais para o menos confiável:
 * 1. tags reais do OSM (segment.osmTags) — access, motorroad, ref, maxspeed;
 * 2. RoadClass estrutural (preenchido pelo enriquecimento ou, na ausência
 *    dele, diretamente pelo provedor de rota);
 * 3. heurística temporária por nome da via — só usada quando nenhuma
 *    informação estruturada está disponível (provedor sem dados + Overpass
 *    sem match). Não deve ser tratada como fonte de verdade.
 */

const TIER_BY_ROAD_CLASS: Record<Exclude<RoadClass, 'unknown'>, SuitabilityTier> = {
  residential: 'very-good',
  service: 'very-good',
  tertiary: 'good',
  secondary: 'good',
  primary: 'caution',
  trunk: 'unsuitable',
  motorway: 'unsuitable',
}

const HIGHWAY_REF_PATTERN = /^BR-?\d{2,3}$/i
const HIGHWAY_NAME_PATTERN = /\bBR-?\d{2,3}\b|\brodovia\b|\bvia\s+expressa\b|\banel\s+vi[aá]rio\b/i
const ARTERIAL_NAME_PATTERN = /\bavenida\b|\bav\.\b/i

export function classifySegment(segment: RouteSegment): SuitabilityTier {
  const tags = segment.osmTags

  // Sinais fortes e explícitos do OSM têm prioridade sobre qualquer heurística.
  if (tags?.access && /^(no|private)$/i.test(tags.access.trim())) {
    return 'prohibited'
  }
  if (tags?.bicycle && /^no$/i.test(tags.bicycle.trim())) {
    return 'prohibited'
  }
  if (tags?.motorroad && /^yes$/i.test(tags.motorroad.trim())) {
    return 'unsuitable'
  }
  if (tags?.ref && HIGHWAY_REF_PATTERN.test(tags.ref.trim())) {
    return 'unsuitable'
  }
  if (tags?.bicycle && /^(yes|designated)$/i.test(tags.bicycle.trim())) {
    return 'very-good'
  }

  if (segment.roadClass !== 'unknown') {
    let tier = TIER_BY_ROAD_CLASS[segment.roadClass]

    const maxSpeed = tags?.maxspeed ? Number.parseInt(tags.maxspeed, 10) : undefined
    if (maxSpeed && Number.isFinite(maxSpeed) && maxSpeed > 80 && tier !== 'unsuitable') {
      tier = 'caution'
    }

    return tier
  }

  // Sem classificação estruturada nem enriquecimento — fallback temporário por nome.
  if (segment.roadName && HIGHWAY_NAME_PATTERN.test(segment.roadName)) return 'unsuitable'
  if (segment.roadName && ARTERIAL_NAME_PATTERN.test(segment.roadName)) return 'good'
  return 'good'
}

/** Penalidade em pontos por km percorrido naquele nível — não é uma proibição binária. */
export const TIER_PENALTY_PER_KM: Record<SuitabilityTier, number> = {
  'very-good': 0,
  good: 0,
  caution: 6,
  unsuitable: 14,
  prohibited: 100,
}

/**
 * Elegibilidade é um eixo separado da pontuação (ver comentário de
 * Eligibility em types/routing.ts). 'unsuitable' continua ELEGÍVEL
 * ('discouraged') — o produto desaconselha vias rápidas/rodovias por
 * qualidade, mas não afirma que sejam proibidas sem um sinal explícito do
 * OSM (access=no, bicycle=no). Só esses sinais explícitos levam a 'prohibited'/'not-allowed'.
 */
export const TIER_ELIGIBILITY: Record<SuitabilityTier, Eligibility> = {
  'very-good': 'allowed',
  good: 'allowed',
  caution: 'allowed',
  unsuitable: 'discouraged',
  prohibited: 'not-allowed',
}

export const TIER_LABEL: Record<SuitabilityTier, string> = {
  'very-good': 'vias locais adequadas',
  good: 'avenidas/vias urbanas',
  caution: 'trechos de atenção (tráfego elevado)',
  unsuitable: 'vias expressas/rodovias',
  prohibited: 'trechos não utilizáveis',
}
