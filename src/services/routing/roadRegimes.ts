import type { SuitabilityReasonCode } from '@/config/mobilityProfiles'
import { assessSegment, type VehicleClassificationContext } from '@/services/routing/roadClassification'
import { roadKey, type RoadRegime } from '@/services/routing/roadKey'
import type { LngLat } from '@/config/region'
import { haversineDistanceMeters } from '@/utils/geo'
import type { RouteSegment } from '@/types/routing'

/**
 * REGIME DE UMA VIA — a mesma avenida não pode ser "adequada" numa rota e
 * "atenção" noutra.
 *
 * O PROBLEMA, medido numa rota real (Goiânia → Aparecida). A "Avenida
 * Transbrasiliana" é, no OpenStreetMap, a BR-153: a pista principal é
 * `motorway` a 80 km/h. Mas trechos curtos da MESMA avenida — acessos, alças,
 * cruzamentos — estão etiquetados `secondary`, que o perfil trata como via
 * urbana comum. Como a classificação olha a tag do trecho em que o segmento
 * cai, o resultado era:
 *
 *   rota 1:  71 m motorway · 1.899 m motorway · 276 m `secondary` (ADEQUADO) ·
 *            7.893 m motorway  → um "buraco" adequado no meio da avenida;
 *   rota 4:  148 m `secondary` → adequado, sem nenhum aviso, na avenida em que
 *            as rotas 1 e 2 correm por via expressa.
 *
 * Duas rotas pela mesma avenida, vereditos opostos — e quem lê só vê a
 * contradição, não a causa.
 *
 * A REGRA. Reunindo o que TODAS as candidatas revelam sobre uma via (pelo
 * nome), se ela é inadequada na maior parte do que se sabe dela, esse é o seu
 * regime, e ele vale para os trechos curtos que o OSM etiquetou diferente.
 *
 * O QUE ISTO É E NÃO É — dito sem enfeite:
 *  - é uma HEURÍSTICA, não um dado: o trecho de 148 m pode de fato ser uma pista
 *    lateral lenta. Não há como saber só com as tags;
 *  - ela é CONSERVADORA: só acrescenta avisos, nunca os tira. Errar para o lado
 *    do aviso custa um alerta a mais; errar para o outro custa uma pessoa numa
 *    pista expressa achando que estava numa rua;
 *  - só vale para o que as candidatas desta viagem mostram. Uma via que nenhuma
 *    delas percorre em trecho inadequado não ganha regime.
 */

/** Abaixo disto de exposição inadequada observada, não há evidência suficiente para um regime. */
const MIN_UNSUITABLE_METERS = 400
/** Fração do que se conhece da via que precisa ser inadequada. */
const MIN_UNSUITABLE_SHARE = 0.6

/**
 * Regimes revelados por TODAS as candidatas juntas. Recebe as listas de
 * segmentos (já enriquecidas) de cada candidata.
 */
export function computeRoadRegimes(
  segmentLists: RouteSegment[][],
  vehicle: VehicleClassificationContext,
): Map<string, RoadRegime> {
  // Avaliação SEM regimes: o regime nasce do que cada trecho diz de si mesmo.
  const semRegimes: VehicleClassificationContext = { ...vehicle, regimes: undefined }

  interface Acumulado {
    total: number
    inadequado: number
    motivos: Map<SuitabilityReasonCode, number>
    anchors: LngLat[]
  }
  const porVia = new Map<string, Acumulado>()

  for (const segmentos of segmentLists) {
    for (const segmento of segmentos) {
      const chave = roadKey(segmento)
      if (!chave || !segmento.osmTags) continue
      const acumulado: Acumulado = porVia.get(chave) ?? { total: 0, inadequado: 0, motivos: new Map(), anchors: [] }
      const avaliacao = assessSegment(segmento, semRegimes)
      acumulado.total += segmento.distanceMeters
      // `prohibited` é impossibilidade física/legal do trecho (escada, acesso
      // proibido) e não descreve a via como um todo.
      if (avaliacao.tier === 'unsuitable') {
        acumulado.inadequado += segmento.distanceMeters
        acumulado.motivos.set(avaliacao.reason, (acumulado.motivos.get(avaliacao.reason) ?? 0) + segmento.distanceMeters)
        // Âncoras a cada ~250 m ao longo do trecho: é a "pegada" geográfica do regime.
        let ultimo: LngLat | null = null
        for (const ponto of segmento.path) {
          if (!ultimo || haversineDistanceMeters(ultimo, ponto) >= 250) {
            acumulado.anchors.push(ponto)
            ultimo = ponto
          }
        }
      }
      porVia.set(chave, acumulado)
    }
  }

  const regimes = new Map<string, RoadRegime>()
  for (const [chave, acumulado] of porVia) {
    if (acumulado.inadequado < MIN_UNSUITABLE_METERS) continue
    if (acumulado.inadequado / acumulado.total < MIN_UNSUITABLE_SHARE) continue
    const motivo = [...acumulado.motivos.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'expressway'
    regimes.set(chave, { tier: 'unsuitable', reason: motivo, anchors: acumulado.anchors })
  }
  return regimes
}
