import type { CandidateRoute } from '@/types/routing'

/**
 * LIMITE DE VELOCIDADE DA VIA ATUAL.
 *
 * O dado sai da tag `maxspeed` do OpenStreetMap, que já é coletada por trecho
 * pelo enriquecimento e já alimenta a classificação de adequação — nenhuma
 * requisição nova, nenhuma fonte nova.
 *
 * A REGRA QUE GOVERNA ESTE MÓDULO INTEIRO: só existe número quando a via foi
 * ETIQUETADA. Nunca se deduz limite a partir da classe da via ("é residencial,
 * logo 40"), porque isso não é o limite daquela rua — é um palpite sobre a
 * legislação apresentado com a cara de um dado. Num indicador que imita placa
 * de trânsito, um palpite errado é pior que um espaço vazio.
 *
 * COBERTURA MEDIDA em Goiânia (6.000 vias amostradas no centro/sul, via
 * Overpass): 21% no geral — motorway 100%, residencial 22%, arteriais 16–18%,
 * trunk 0%. Ou seja, o indicador aparece em cerca de uma via a cada cinco e
 * fica AUSENTE no resto. Ausente é o comportamento correto: quem olha uma placa
 * e não a encontra sabe que não sabe; quem lê um número inventado acha que sabe.
 */

export interface SpeedLimit {
  kmh: number
  /** Nome da via a que o limite pertence, quando o OSM o traz. */
  roadName?: string
}

/**
 * Converte o valor cru da tag. Devolve null para tudo que não for um número
 * explícito.
 *
 * O OSM aceita várias formas em `maxspeed`, e a maioria NÃO é um limite
 * concreto daquela via:
 *
 *   - `"50"`            → 50 km/h. Aceito.
 *   - `"30 mph"`        → convertido. Aceito (raro no Brasil, comum na base).
 *   - `"BR:urban"`      → REJEITADO. É referência à regra geral do CTB para
 *                         área urbana, não uma placa naquela rua. Exibir "60"
 *                         a partir disso seria afirmar algo que a via não diz.
 *   - `"none"`, `"walk"`, `"variable"`, `"signals"` → REJEITADOS pelo mesmo
 *                         motivo: não são um número daquela via.
 */
export function parseMaxSpeed(raw: string | undefined): number | null {
  if (!raw) return null

  const texto = raw.trim().toLowerCase()
  const mph = texto.endsWith('mph')
  const numero = Number.parseFloat(texto)

  // `Number.parseFloat('BR:urban')` é NaN; `parseFloat('50 mph')` é 50. É esta
  // diferença que separa dado de referência normativa.
  if (!Number.isFinite(numero) || numero <= 0) return null
  // Um limite acima de 130 km/h não existe em via brasileira: é erro de
  // etiquetagem, e repeti-lo seria propagar o erro.
  if (numero > 130) return null

  const kmh = mph ? numero * 1.609344 : numero
  return Math.round(kmh)
}

/**
 * Limite da via em que o usuário está AGORA.
 *
 * Localiza o segmento pela distância já percorrida sobre a rota — mesma
 * aritmética que os alertas de trecho usam. Vale sobre a rota, não sobre a
 * posição bruta do GPS: é mais estável e não pula para a rua vizinha quando o
 * sinal oscila.
 */
export function currentSpeedLimit(
  route: CandidateRoute,
  distanceTraveledMeters: number,
): SpeedLimit | null {
  let acumulado = 0
  for (const segment of route.segments) {
    acumulado += segment.distanceMeters
    if (acumulado < distanceTraveledMeters) continue

    const kmh = parseMaxSpeed(segment.osmTags?.maxspeed)
    if (kmh == null) return null
    return { kmh, roadName: segment.roadName ?? segment.osmTags?.name }
  }
  return null
}
