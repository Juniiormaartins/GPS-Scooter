import type { LngLat } from '@/config/region'
import type { GeocodingResult } from '@/services/geocoding'
import { foldText } from '@/services/search/placeIntent'
import { haversineDistanceMeters } from '@/utils/geo'

/**
 * ORDENAÇÃO DOS RESULTADOS DA BUSCA — texto E distância.
 *
 * O QUE ERA. A lista era ordenada só por quanto o NOME lembrava o texto
 * digitado. A distância não pesava nada: o "≈ 7 km em linha reta" ao lado de
 * cada linha era enfeite. Resultado, na queixa real: digitar "farmácia" trazia
 * uma a 7 km e outra a 16 km na frente de uma a 2 km, porque os nomes das
 * distantes tinham a palavra.
 *
 * O QUE É AGORA. Dois sinais somados:
 *  - TEXTO: o quanto o nome casa com o que foi digitado (sem acento);
 *  - PROXIMIDADE: um bônus que cai pela metade a cada 2 km.
 *
 * O PESO DA DISTÂNCIA DEPENDE DO QUE O USUÁRIO PEDIU. Quem digita um TIPO de
 * lugar ("farmácia", "posto") quer o mais perto, e a distância manda — entre
 * duas farmácias a ordem é a distância, ponto. Quem digita um NOME ("Shopping
 * Flamboyant") quer aquele lugar, esteja onde estiver, e o texto manda; a
 * distância só desempata filiais da mesma rede. Dar o mesmo peso aos dois
 * casos faria um "Flamboyant" parcial a 500 m ganhar do shopping exato a 4 km.
 */

export interface RankCandidate {
  result: GeocodingResult
  /** Bônus da FONTE (estabelecimento real sobre endereço puro, etc.). */
  sourceBonus: number
  /** Veio de uma busca por categoria e é do tipo pedido. */
  intentMatch?: boolean
}

/** Metros em que o bônus de proximidade cai pela metade. */
const HALF_LIFE_M = 2000

/** Bônus máximo (a 0 m) — categoria pura vs. busca por nome. */
const MAX_PROXIMITY_INTENT = 60
const MAX_PROXIMITY_NAME = 25

export function proximityBonus(distanceMeters: number, max: number): number {
  return max * Math.pow(0.5, distanceMeters / HALF_LIFE_M)
}

/**
 * Quanto o nome casa com o texto — 0 a 100. Ignora acento: "farmacia" tem de
 * casar com "Farmácia". Antes a comparação era literal, e quem digitava sem
 * acento (o normal no celular) perdia metade dos resultados.
 */
/**
 * A palavra está no nome? Siglas e palavras CURTAS (até 3 letras) só valem como
 * palavra inteira. Medido: "UPA" casava com "Gr-upa-mento de Incêndio",
 * "Po-upa-qui" e "Ro-upa-s" — três resultados sem relação nenhuma, num campo
 * onde quem digita uma sigla quer exatamente aquela sigla.
 */
function contemPalavra(nome: string, palavra: string): boolean {
  if (palavra.length > 3) return nome.includes(palavra)
  return new RegExp(`(^|[^a-z0-9])${palavra}([^a-z0-9]|$)`).test(nome)
}

export function textRelevance(label: string, query: string): number {
  const nome = foldText(label)
  const busca = foldText(query).trim()
  if (!busca) return 0
  if (nome === busca) return 100
  // Começo do nome vale sempre: quem digita "ban" a caminho de "Banco" está no meio da palavra.
  if (nome.startsWith(busca)) return 80
  if (contemPalavra(nome, busca)) return 60

  const palavras = busca
    .replace(/[,.]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (palavras.length === 0) return 0
  const casadas = palavras.filter((palavra) => contemPalavra(nome, palavra)).length
  return (casadas / palavras.length) * 40
}

export interface RankOptions {
  query: string
  near: LngLat | null
  /** A consulta é um TIPO de lugar ("farmácia") — a distância passa a mandar. */
  categoryOnly: boolean
}

export function scoreCandidate(candidate: RankCandidate, options: RankOptions): number {
  const { result } = candidate
  const texto = textRelevance(result.label, options.query)
  const distancia = options.near ? haversineDistanceMeters(options.near, result.point) : null

  if (options.categoryOnly) {
    // Entre os lugares do tipo pedido, só a distância decide. O que NÃO é do
    // tipo (uma rua chamada "Farmácia", a 20 m) fica abaixo de QUALQUER um que
    // seja — por isso o teto dele é 35, abaixo do piso de 70 de quem é.
    const prox = distancia != null ? proximityBonus(distancia, MAX_PROXIMITY_INTENT) : 0
    if (candidate.intentMatch) return 70 + prox
    // Nem é do tipo nem casa com o texto: não é resultado, é ruído.
    if (texto === 0) return -1
    return Math.min(texto, 40) * 0.5 + prox * 0.25
  }

  const prox = distancia != null ? proximityBonus(distancia, MAX_PROXIMITY_NAME) : 0
  // Sem bônus por `intentMatch` aqui: só uma das fontes o marca, e o bônus
  // desordenava resultados iguais ("Droga Raia" a 1,3 km depois da de 3,3 km).
  return texto + candidate.sourceBonus + prox
}

/** Ordena do melhor para o pior. Estável: empate mantém a ordem de chegada. */
export function rankCandidates(candidates: RankCandidate[], options: RankOptions): GeocodingResult[] {
  const ordenados = candidates
    .map((candidate, index) => ({ candidate, index, score: scoreCandidate(candidate, options) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)

  /*
    EM BUSCA POR CATEGORIA, O RUÍDO SAI. Os provedores de texto respondem
    "farmácias" com o que contém a palavra: uma rua, um número ("1922"), um
    prédio. Enquanto a categoria não chegou, isso é melhor que lista vazia; mas
    com três lugares do tipo já em mãos, o resto só atrapalha — e era o que
    aparecia, por um instante, nas listas parciais.
  */
  if (options.categoryOnly) {
    const doTipo = ordenados.filter((entry) => entry.candidate.intentMatch)
    if (doTipo.length >= 3) return doTipo.map((entry) => entry.candidate.result)
    // Menos de três do tipo: ficam os que ao menos casam com o texto.
    return ordenados.filter((entry) => entry.score >= 0).map((entry) => entry.candidate.result)
  }
  return ordenados.map((entry) => entry.candidate.result)
}
