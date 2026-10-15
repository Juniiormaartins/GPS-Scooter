import type { SuitabilityReasonCode } from '@/config/mobilityProfiles'
import type { LngLat } from '@/config/region'
import type { RouteSegment, SuitabilityTier } from '@/types/routing'

/**
 * Funções puras sobre o NOME de uma via — separadas de `roadRegimes.ts` para
 * `roadClassification.ts` poder usá-las sem importação circular.
 */

export interface RoadRegime {
  tier: SuitabilityTier
  reason: SuitabilityReasonCode
  /**
   * Pontos ao longo dos trechos em que a via foi OBSERVADA como inadequada. O
   * regime só vale perto deles: nomes se repetem na cidade (a "Rua 4" de um
   * bairro não é a de outro), e uma via que é expressa num lugar não torna
   * inadequada a homônima do outro lado.
   */
  anchors: LngLat[]
}

/** Distância máxima de um âncora para um trecho herdar o regime, em metros. */
export const REGIME_REACH_METERS = 1200

const NAME_PREFIXES = /^(avenida|av|rua|rodovia|rod|alameda|estrada|marginal|via|anel|trevo)\s+/

/**
 * Chave estável do nome: sem acento, sem parênteses ("(GO-020)"), sem o tipo de
 * logradouro. "Avenida Transbrasiliana" e "Av. Transbrasiliana" são a mesma via.
 */
export function roadKey(segment: Pick<RouteSegment, 'roadName' | 'osmTags'>): string | null {
  const bruto = segment.roadName ?? segment.osmTags?.name
  if (!bruto) return null
  const chave = bruto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(NAME_PREFIXES, '')
    .trim()
  return chave.length >= 4 ? chave : null
}

/** Trechos que nunca herdam regime de via motorizada: são outra coisa (ciclovia, calçada, escada). */
const NON_MOTOR_KINDS = new Set(['cycleway', 'footway', 'pedestrian', 'path', 'steps', 'track'])

export function inheritsRegime(segment: Pick<RouteSegment, 'wayKind'>): boolean {
  return !segment.wayKind || !NON_MOTOR_KINDS.has(segment.wayKind)
}

