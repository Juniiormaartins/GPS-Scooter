/**
 * Configuração geográfica centralizada da área de atuação inicial.
 * Toda validação de "está dentro da área suportada" deve usar isBoundsContained
 * a partir daqui — nunca duplicar coordenadas/limites em componentes.
 */

export interface LngLat {
  lng: number
  lat: number
}

export interface BoundingBox {
  /** Canto sudoeste (menor lng, menor lat). */
  southWest: LngLat
  /** Canto nordeste (maior lng, maior lat). */
  northEast: LngLat
}

export interface SupportedRegion {
  id: string
  label: string
  center: LngLat
  initialZoom: number
  bounds: BoundingBox
  cities: string[]
}

/**
 * Limites cobrindo Goiânia e Aparecida de Goiânia como UMA ÚNICA área
 * operacional — as duas cidades formam uma malha urbana contínua, então a
 * checagem de "está na região suportada" é feita PONTO A PONTO
 * (isPointWithinRegion(origin) && isPointWithinRegion(destination)), nunca
 * exigindo que origem e destino sejam do mesmo município. Uma rota Aparecida
 * de Goiânia → Goiânia é normal e esperada.
 *
 * Retângulo calculado a partir do bounding box oficial de cada cidade (via
 * Nominatim), unindo os dois — não é mais uma estimativa livre. Aproximação
 * retangular ainda é intencional para esta fase; pode virar um polígono real
 * (GeoJSON) futuramente sem alterar o restante da aplicação.
 *
 * Bug real corrigido aqui: o retângulo anterior tinha o limite sul em
 * lat -16.82, mas bairros legítimos de Aparecida de Goiânia (ex: Parque
 * Montreal, lat ≈ -16.84) ficam mais ao sul que isso — a origem do usuário
 * era rejeitada mesmo estando dentro da cidade certa.
 */
export const SUPPORTED_REGION: SupportedRegion = {
  id: 'goiania-aparecida',
  label: 'Goiânia e Aparecida de Goiânia',
  center: { lng: -49.2648, lat: -16.6799 },
  initialZoom: 12,
  bounds: {
    southWest: { lng: -49.46, lat: -16.9 },
    northEast: { lng: -49.06, lat: -16.44 },
  },
  cities: ['Goiânia', 'Aparecida de Goiânia'],
}

/** Ponto a ponto — NÃO compara se origem e destino são da mesma cidade. Ver comentário de SUPPORTED_REGION acima. */
export function isPointWithinRegion(point: LngLat, region: SupportedRegion = SUPPORTED_REGION): boolean {
  const { southWest, northEast } = region.bounds
  return (
    point.lng >= southWest.lng &&
    point.lng <= northEast.lng &&
    point.lat >= southWest.lat &&
    point.lat <= northEast.lat
  )
}
