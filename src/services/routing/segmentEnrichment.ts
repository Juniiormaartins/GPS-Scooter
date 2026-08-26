import type { LngLat } from '@/config/region'
import { haversineDistanceMeters } from '@/utils/geo'
import { normalizeWayKind } from '@/services/routing/roadClassification'
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

/**
 * MESMA ORIGEM, de propósito — ver api/overpass.ts e o proxy em vite.config.ts.
 *
 * Consultar `overpass-api.de` direto do navegador funciona enquanto ele
 * responde 200. Quando ele RECUSA (429 por limite de taxa, 504 de gateway), a
 * página de erro vem sem `Access-Control-Allow-Origin`, o navegador bloqueia a
 * resposta e o código recebe um `TypeError: Failed to fetch` sem status. Foi
 * assim que a classificação por trecho parou de aparecer em produção sem
 * deixar rastro legível.
 */
const OVERPASS_BASE_URL = '/api/overpass'

/**
 * A instância pública dá DOIS slots simultâneos por IP (confirmado em
 * /api/status: "Rate limit: 2"). O enriquecimento roda sobre a rota escolhida
 * e todas as alternativas — cinco candidatas viravam cinco consultas
 * simultâneas, três delas recusadas de saída.
 *
 * Uma por vez: mais lento no papel, e na prática MUITO mais rápido, porque
 * consulta recusada não traz dado nenhum e ainda queima uma tentativa.
 */
let filaOverpass: Promise<unknown> = Promise.resolve()

function emFila<T>(tarefa: () => Promise<T>): Promise<T> {
  const resultado = filaOverpass.then(tarefa, tarefa)
  // A fila nunca rejeita: uma falha não pode impedir a próxima consulta.
  filaOverpass = resultado.then(
    () => undefined,
    () => undefined,
  )
  return resultado
}
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

/**
 * Cache de ÁREAS já consultadas, com busca por CONTINÊNCIA.
 *
 * Antes a chave era o bbox arredondado da rota, e bastava a alternativa
 * desviar duas quadras para gerar outra chave e outra consulta. Guardando a
 * área consultada e perguntando "alguma já cobre este retângulo?", as cinco
 * candidatas de uma mesma viagem reaproveitam UMA resposta — que é o que
 * mantém o uso dentro dos dois slots disponíveis.
 */
interface AreaCacheada {
  bbox: BoundingBox
  ways: Promise<OverpassWay[]>
  chave: string
}

const areasCacheadas: AreaCacheada[] = []

function contem(externo: BoundingBox, interno: BoundingBox): boolean {
  return (
    externo.south <= interno.south &&
    externo.west <= interno.west &&
    externo.north >= interno.north &&
    externo.east >= interno.east
  )
}

function uneBoundingBoxes(caixas: BoundingBox[]): BoundingBox {
  return {
    south: Math.min(...caixas.map((c) => c.south)),
    west: Math.min(...caixas.map((c) => c.west)),
    north: Math.max(...caixas.map((c) => c.north)),
    east: Math.max(...caixas.map((c) => c.east)),
  }
}

/**
 * Teto do lado do span da união.
 *
 * Unir as caixas das candidatas quase sempre dá um retângulo pouco maior que o
 * de uma delas — elas percorrem o mesmo corredor. Mas se uma alternativa
 * divergir muito, a união viraria uma consulta de dezenas de quilômetros, que
 * o endpoint público recusa por tamanho. Acima deste limite, cada rota volta a
 * consultar a sua própria área.
 */
const MAX_UNION_SPAN_DEG = 0.25

function spanExcedido(bbox: BoundingBox): boolean {
  return bbox.north - bbox.south > MAX_UNION_SPAN_DEG || bbox.east - bbox.west > MAX_UNION_SPAN_DEG
}

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
// Medido contra o endpoint público: uma consulta de bbox urbano em Goiânia
// levou 14,7 s para responder 200. Com 6 s, o enriquecimento falhava quase
// sempre e TODA a rota caía para 'unknown' — ou seja, a classificação por
// trecho simplesmente não acontecia. Os espelhos testados estavam piores
// (kumi.systems 502, private.coffee 500), então a saída foi dar tempo.
const CLIENT_TIMEOUT_MS = 13000

/**
 * Chave de cache persistente por sessão.
 *
 * O cache era só de memória, então recarregar a página descartava tudo e a
 * mesma área era consultada de novo — com o Overpass público, cada consulta
 * custa 10–15 s e pode falhar. `sessionStorage` mantém o resultado enquanto a
 * aba viver, que cobre o caso real: sair da navegação, voltar, refazer a rota.
 */
const SESSION_CACHE_PREFIX = 'gps-scooter:overpass:'

function readSessionCache(key: string): OverpassWay[] | null {
  try {
    const raw = sessionStorage.getItem(SESSION_CACHE_PREFIX + key)
    return raw ? (JSON.parse(raw) as OverpassWay[]) : null
  } catch {
    return null
  }
}

function writeSessionCache(key: string, ways: OverpassWay[]) {
  try {
    sessionStorage.setItem(SESSION_CACHE_PREFIX + key, JSON.stringify(ways))
  } catch {
    // Cota estourada ou storage bloqueado — seguir sem persistir não quebra nada.
  }
}

async function requestWays(query: string, timeoutMs: number): Promise<OverpassWay[]> {
  const abortController = new AbortController()
  const abortTimer = setTimeout(() => abortController.abort(), timeoutMs)
  try {
    const response = await fetch(OVERPASS_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: query,
      signal: abortController.signal,
    })
    if (!response.ok) {
      // Agora o status CHEGA — antes, vindo de outra origem, um 429 aparecia
      // como falha de rede genérica. 429/504 significam "tente de novo mais
      // devagar", e não "não há dado de via aqui".
      const erro = new Error(`Overpass respondeu ${response.status}`) as Error & { status?: number }
      erro.status = response.status
      throw erro
    }
    const payload = (await response.json()) as { elements?: OverpassWay[] }
    return payload.elements ?? []
  } finally {
    clearTimeout(abortTimer)
  }
}

async function fetchWaysInBoundingBox(bbox: BoundingBox): Promise<OverpassWay[]> {
  // Alguma área já consultada cobre esta rota? É o caso normal quando as
  // alternativas da mesma viagem chegam em seguida.
  const jaCoberta = areasCacheadas.find((area) => contem(area.bbox, bbox))
  if (jaCoberta) return jaCoberta.ways

  const cacheKey = boundingBoxCacheKey(bbox)

  const persisted = readSessionCache(cacheKey)
  if (persisted) {
    const resolved = Promise.resolve(persisted)
    areasCacheadas.push({ bbox, ways: resolved, chave: cacheKey })
    return resolved
  }

  const query = `[out:json][timeout:20];way["highway"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});out tags geom;`

  /**
   * Uma nova tentativa, com espera proporcional ao motivo.
   *
   * Recusa por limite de taxa (429) precisa de mais fôlego que um timeout: as
   * consultas irmãs ainda estão ocupando os dois slots do IP. Repetir em 800 ms
   * garantia só um segundo "não".
   */
  const request = emFila(async () => {
    try {
      return await requestWays(query, CLIENT_TIMEOUT_MS)
    } catch (erro) {
      const status = (erro as { status?: number }).status
      const espera = status === 429 || status === 504 ? 2500 : 800
      await new Promise((resolve) => setTimeout(resolve, espera))
      return requestWays(query, CLIENT_TIMEOUT_MS)
    }
  })
    .then((ways) => {
      writeSessionCache(cacheKey, ways)
      return ways
    })
    .catch(() => {
      // Falha nas duas tentativas: tira a área do cache para que a próxima
      // rota possa tentar de novo. Sem isso, uma falha isolada deixaria a
      // região sem classificação pelo resto da sessão.
      const i = areasCacheadas.findIndex((area) => area.chave === cacheKey)
      if (i >= 0) areasCacheadas.splice(i, 1)
      return [] as OverpassWay[]
    })

  areasCacheadas.push({ bbox, ways: request, chave: cacheKey })
  return request
}

/**
 * Consulta UMA área cobrindo todas as candidatas, antes de enriquecer cada uma.
 *
 * Sem isto, `enrichRouteResult` disparava uma consulta por candidata, em
 * paralelo, contra um endpoint que aceita duas por IP: as excedentes eram
 * recusadas e a rota ficava sem classificação por trecho. Com a área unida no
 * cache, as chamadas seguintes de `enrichRouteSegments` não tocam a rede.
 *
 * Best-effort: se a união for grande demais ou a consulta falhar, cada rota
 * segue consultando a sua própria área — o comportamento anterior, só que
 * agora enfileirado.
 */
export async function prefetchWaysForRoutes(routes: CandidateRoute[]): Promise<void> {
  const caixas = routes.map(computeRouteBoundingBox)
  if (caixas.length === 0) return
  const uniao = uneBoundingBoxes(caixas)
  if (spanExcedido(uniao)) return
  try {
    await fetchWaysInBoundingBox(uniao)
  } catch {
    // Sem união utilizável: cada rota consulta a sua área.
  }
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
    // Tipo de via normalizado — é o que a classificação por perfil consulta.
    // Sem isto, calçada, ciclovia e escada continuariam invisíveis.
    wayKind: normalizeWayKind(osmTags.highway),
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
