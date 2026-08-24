import type { LngLat } from '@/config/region'
import { haversineDistanceMeters } from '@/utils/geo'
import type { CandidateRoute, OsmWayTags, RoadClass, RouteSegment } from '@/types/routing'

/**
 * Camada de enriquecimento de segmentos com dados reais da malha viária do
 * OpenStreetMap (via Overpass API). Fica entre o provedor de rota (OSRM) e a
 * classificação de adequação (roadClassification.ts) — nenhuma das duas
 * camadas depende diretamente da Overpass API; se o provedor de
 * enriquecimento mudar no futuro, só este arquivo precisa mudar.
 *
 * Estratégia (uma consulta por rota, não por segmento/ponto):
 * 1. calcula o bounding box da geometria completa da rota;
 * 2. busca, numa única query, todas as `way["highway"]` dentro desse bbox
 *    (com geometria inclusa via `out geom`, evitando uma segunda consulta
 *    por nós);
 * 3. casa cada segmento da rota com a way mais próxima (por proximidade do
 *    ponto médio do segmento aos nós da way), dentro de um raio de tolerância.
 *
 * Falha de rede/timeout é tratada como best-effort: o enriquecimento
 * simplesmente não acontece e os segmentos originais (roadClass do
 * provedor + nome) seguem para o fallback heurístico do roadClassification.
 *
 * Otimização futura (fora de escopo agora): indexar as ways num grid/quadtree
 * para casamento em tempo sublinear em vez de O(segmentos × ways × nós), e
 * usar distância ponto-a-segmento em vez de ponto-a-nó mais próximo.
 */

const OVERPASS_BASE_URL = 'https://overpass-api.de/api/interpreter'
const MATCH_DISTANCE_METERS = 25
const BBOX_PADDING_DEG = 0.002 // ~200 m de folga ao redor da rota

interface OverpassWay {
  id: number
  tags?: Record<string, string>
  geometry?: { lat: number; lon: number }[]
}

interface OverpassResponse {
  elements: OverpassWay[]
}

interface BoundingBox {
  south: number
  west: number
  north: number
  east: number
}

const KNOWN_ROAD_CLASSES: RoadClass[] = [
  'motorway',
  'trunk',
  'primary',
  'secondary',
  'tertiary',
  'residential',
  'service',
]

/** Cache em memória por bbox arredondado — evita reconsultar a mesma área na mesma sessão. */
const boundingBoxCache = new Map<string, Promise<OverpassWay[]>>()

function computeRouteBoundingBox(route: CandidateRoute): BoundingBox {
  let south = Infinity
  let west = Infinity
  let north = -Infinity
  let east = -Infinity

  for (const point of route.geometry) {
    south = Math.min(south, point.lat)
    north = Math.max(north, point.lat)
    west = Math.min(west, point.lng)
    east = Math.max(east, point.lng)
  }

  return {
    south: south - BBOX_PADDING_DEG,
    west: west - BBOX_PADDING_DEG,
    north: north + BBOX_PADDING_DEG,
    east: east + BBOX_PADDING_DEG,
  }
}

function boundingBoxCacheKey(bbox: BoundingBox): string {
  const round = (value: number) => value.toFixed(3)
  return `${round(bbox.south)},${round(bbox.west)},${round(bbox.north)},${round(bbox.east)}`
}

/**
 * Teto de espera do lado do CLIENTE. O `[out:json][timeout:N]` da consulta é
 * uma instrução para o servidor abortar o processamento — ele não cobre o
 * caso de a resposta simplesmente nunca chegar (fila, rede, servidor
 * pendurado), que é comum na instância pública do Overpass e foi observado
 * várias vezes durante o desenvolvimento.
 *
 * Sem este teto, o fetch fica pendente para sempre, o Promise.all de
 * planRoute() nunca resolve e a tela fica em "Calculando rota…" eternamente —
 * exatamente o travamento relatado. O enriquecimento é best-effort: se
 * estourar, a rota é avaliada sem as tags do OSM em vez de travar o app.
 */
const CLIENT_TIMEOUT_MS = 6000

async function fetchWaysInBoundingBox(bbox: BoundingBox): Promise<OverpassWay[]> {
  const cacheKey = boundingBoxCacheKey(bbox)
  const cached = boundingBoxCache.get(cacheKey)
  if (cached) return cached

  const query = `[out:json][timeout:20];way["highway"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});out tags geom;`

  const abortController = new AbortController()
  const abortTimer = setTimeout(() => abortController.abort(), CLIENT_TIMEOUT_MS)

  const request = fetch(OVERPASS_BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: query,
    signal: abortController.signal,
  })
    .then(async (response) => {
      if (!response.ok) throw new Error('Overpass request failed')
      // Sob carga o Overpass responde 200 com uma PÁGINA HTML de erro; sem
      // esta checagem, o response.json() estoura de um jeito confuso.
      const contentType = response.headers.get('content-type') ?? ''
      if (!contentType.includes('json')) throw new Error('Overpass respondeu em formato inesperado')
      const data = (await response.json()) as OverpassResponse
      return data.elements ?? []
    })
    .catch(() => {
      // Falha (timeout, rede, HTML de erro): remove do cache para que a
      // próxima rota nesta mesma área possa tentar de novo. Sem isso, uma
      // única falha deixaria a região sem classificação pelo resto da sessão.
      boundingBoxCache.delete(cacheKey)
      return [] as OverpassWay[]
    })
    .finally(() => clearTimeout(abortTimer))

  boundingBoxCache.set(cacheKey, request)
  return request
}

function segmentMidpoint(path: LngLat[]): LngLat {
  return path[Math.floor(path.length / 2)] ?? path[0]
}

function distancePointToWay(point: LngLat, way: OverpassWay): number {
  if (!way.geometry || way.geometry.length === 0) return Infinity

  let min = Infinity
  for (const node of way.geometry) {
    const distance = haversineDistanceMeters(point, { lng: node.lon, lat: node.lat })
    if (distance < min) min = distance
  }
  return min
}

function toOsmTags(tags: Record<string, string> = {}): OsmWayTags {
  return {
    highway: tags.highway,
    ref: tags.ref,
    name: tags.name,
    maxspeed: tags.maxspeed,
    motorroad: tags.motorroad,
    bicycle: tags.bicycle,
    foot: tags.foot,
    lanes: tags.lanes,
    oneway: tags.oneway,
    surface: tags.surface,
    access: tags.access,
  }
}

function mapHighwayTagToRoadClass(highway?: string): RoadClass | undefined {
  if (!highway) return undefined
  const normalized = highway.replace(/_link$/, '')
  return KNOWN_ROAD_CLASSES.includes(normalized as RoadClass) ? (normalized as RoadClass) : undefined
}

function matchSegment(segment: RouteSegment, ways: OverpassWay[]): RouteSegment {
  const point = segmentMidpoint(segment.path)
  let closestWay: OverpassWay | null = null
  let closestDistance = Infinity

  for (const way of ways) {
    const distance = distancePointToWay(point, way)
    if (distance < closestDistance) {
      closestDistance = distance
      closestWay = way
    }
  }

  if (!closestWay || closestDistance > MATCH_DISTANCE_METERS) {
    return segment
  }

  const osmTags = toOsmTags(closestWay.tags)
  return {
    ...segment,
    osmTags,
    roadClass: mapHighwayTagToRoadClass(osmTags.highway) ?? segment.roadClass,
    roadName: osmTags.name || segment.roadName,
  }
}

/**
 * Enriquece os segmentos de uma rota candidata com tags reais do OSM.
 * Nunca lança — em caso de falha, devolve os segmentos originais inalterados.
 */
export async function enrichRouteSegments(route: CandidateRoute): Promise<RouteSegment[]> {
  try {
    const bbox = computeRouteBoundingBox(route)
    const ways = await fetchWaysInBoundingBox(bbox)
    if (ways.length === 0) return route.segments

    return route.segments.map((segment) => matchSegment(segment, ways))
  } catch {
    return route.segments
  }
}
