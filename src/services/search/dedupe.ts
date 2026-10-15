import type { LngLat } from '@/config/region'
import type { GeocodingResult } from '@/services/geocoding'
import { foldText } from '@/services/search/placeIntent'
import { textRelevance } from '@/services/search/ranking'
import { haversineDistanceMeters } from '@/utils/geo'

/**
 * QUANDO DOIS RESULTADOS SÃO "O MESMO LUGAR".
 *
 * A regra era só distância: menos de 40 m, é duplicado — e vence quem chegou
 * primeiro. Servia enquanto as fontes eram consultadas em ordem fixa. Agora
 * elas respondem de forma assíncrona e a ordem de chegada é aleatória, e a
 * regra passou a causar dois defeitos medidos:
 *
 *  - "Shopping Flamboyant" sumia da lista: o ponto dele cai a menos de 40 m da
 *    loja CVC que fica DENTRO dele, e a loja, que chegou antes, "absorvia" o
 *    shopping. O lugar que a pessoa digitou literalmente era descartado.
 *  - a mesma rua aparecia quatro vezes ("Rua 82"), porque o OSM a divide em
 *    trechos e cada trecho vinha como um resultado.
 *
 * Agora é preciso que POSIÇÃO e NOME combinem — e quando dois são o mesmo
 * lugar, sobrevive o que melhor casa com o texto digitado.
 */

const SAME_SPOT_METERS = 40
/** Trechos da mesma rua, do mesmo bairro: o mesmo nome, só sem categoria, até esta distância. */
const SAME_STREET_METERS = 800

function tokens(foldedLabel: string): string[] {
  return foldedLabel.split(/[^a-z0-9]+/).filter((token) => token.length >= 4)
}

export function isSamePlace(a: GeocodingResult, b: GeocodingResult): boolean {
  const distancia = haversineDistanceMeters(a.point, b.point)
  if (distancia >= SAME_STREET_METERS) return false

  const na = foldText(a.label)
  const nb = foldText(b.label)
  const semCategoria = a.poiCategory == null || b.poiCategory == null

  // A mesma rua/bairro em trechos diferentes: mesmo nome exato, nenhum dos dois
  // é um estabelecimento. Duas "Drogasil" NÃO entram aqui — têm categoria, e
  // são duas farmácias de verdade.
  if (na === nb && semCategoria && (a.isArea || b.isArea || a.poiCategory == null || b.poiCategory == null)) return true

  if (distancia >= SAME_SPOT_METERS) return false

  // Dentro de 40 m: o nome tem de ser compatível.
  if (na === nb || na.includes(nb) || nb.includes(na)) return true
  const ta = tokens(na)
  const tb = tokens(nb)
  if (ta.some((token) => tb.includes(token))) return true
  // Um dos dois é só um endereço (sem categoria): é o mesmo lugar visto por
  // outra fonte, e a categoria de um completa o outro.
  return semCategoria
}

/**
 * Funde `other` em `survivor`: fica o MELHOR TEXTO para o que foi digitado, e a
 * categoria que faltar é adotada do outro. Devolve o próprio `survivor`.
 */
export function mergeInto(
  survivor: GeocodingResult,
  other: GeocodingResult,
  query: string,
  near: LngLat | null = null,
): GeocodingResult {
  const categoria = survivor.poiCategory ?? other.poiCategory
  const intent = survivor.intentMatch || other.intentMatch

  const textoOutro = textRelevance(other.label, query)
  const textoSobrevivente = textRelevance(survivor.label, query)
  // Empate de texto: fica o MAIS PERTO de quem busca. A mesma rua vem em vários
  // trechos, e mostrar o trecho a 250 m quando há um a 37 m é mostrar o errado.
  const maisPerto =
    near != null &&
    textoOutro === textoSobrevivente &&
    haversineDistanceMeters(near, other.point) < haversineDistanceMeters(near, survivor.point)

  if (textoOutro > textoSobrevivente || maisPerto) {
    // O novo casa melhor: o sobrevivente passa a ser ELE (rótulo, posição, tipo).
    Object.assign(survivor, {
      label: other.label,
      secondaryLabel: other.secondaryLabel ?? survivor.secondaryLabel,
      point: other.point,
      isArea: other.isArea,
    })
  }
  if (!survivor.isArea && categoria != null) survivor.poiCategory = categoria
  if (intent) survivor.intentMatch = true
  return survivor
}
