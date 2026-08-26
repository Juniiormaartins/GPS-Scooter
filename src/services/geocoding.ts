import { env, isGeocodingConfigured } from '@/config/env'
import { SUPPORTED_REGION, type LngLat } from '@/config/region'
import { haversineDistanceMeters } from '@/utils/geo'

export interface GeocodingResult {
  label: string
  /** Cidade/bairro ou categoria do local, quando disponível — para exibição em duas linhas na UI. */
  secondaryLabel?: string
  point: LngLat
  /** True quando a sugestão veio do histórico local, não de um provedor externo — a UI marca essas com ícone de relógio. */
  fromHistory?: boolean
}

export interface GeocodingProvider {
  isConfigured: boolean
  search(query: string): Promise<GeocodingResult[]>
  /** Geocodificação reversa (coordenada → endereço/nome aproximado). Retorna null se não conseguir resolver — nunca lança para não quebrar o fluxo de localização atual. */
  reverseGeocode(point: LngLat): Promise<string | null>
}

/**
 * Busca de ESTABELECIMENTOS/POIs nomeados — deliberadamente separado de
 * GeocodingProvider (que resolve endereços/ruas/bairros). São preocupações
 * diferentes com fontes diferentes hoje (Nominatim + Overpass) e podem
 * evoluir independentemente — ex: trocar por um provedor de Places
 * comercial no futuro sem tocar em endereço/mapa/rota. Ver getPoiProvider().
 * Não expõe reverseGeocode: não é responsabilidade de um provedor de POI.
 */
export interface PoiProvider {
  isConfigured: boolean
  search(query: string): Promise<GeocodingResult[]>
}

class UnconfiguredGeocodingProvider implements GeocodingProvider {
  isConfigured = false

  async search(_query: string): Promise<GeocodingResult[]> {
    throw new Error(
      'Serviço de geocodificação não configurado. Defina VITE_GEOCODING_BASE_URL ou VITE_MAPTILER_API_KEY no .env.',
    )
  }

  async reverseGeocode(_point: LngLat): Promise<string | null> {
    return null
  }
}

interface NominatimResult {
  display_name: string
  lat: string
  lon: string
  class?: string
  type?: string
}

/** Categorias OSM (class/type) mais comuns traduzidas para um rótulo curto em pt-BR. */
const NOMINATIM_CATEGORY_LABEL: Record<string, string> = {
  mall: 'Shopping',
  supermarket: 'Supermercado',
  restaurant: 'Restaurante',
  fast_food: 'Restaurante',
  cafe: 'Cafeteria',
  fuel: 'Posto de combustível',
  fitness_centre: 'Academia',
  hospital: 'Hospital',
  clinic: 'Clínica',
  school: 'Escola',
  university: 'Universidade',
  park: 'Parque',
  pharmacy: 'Farmácia',
  bank: 'Banco',
  hotel: 'Hotel',
  bus_stop: 'Ponto de ônibus',
  suburb: 'Bairro',
  neighbourhood: 'Bairro',
}

function describeNominatimResult(result: NominatimResult): { label: string; secondaryLabel: string } {
  const parts = result.display_name.split(',').map((part) => part.trim())
  const label = parts[0] ?? result.display_name
  const category = result.type ? NOMINATIM_CATEGORY_LABEL[result.type] : undefined
  const place = parts.length > 2 ? parts[parts.length - 3] : parts[parts.length - 1]
  const secondaryLabel = category ? `${category} · ${place}` : parts.slice(1, 3).join(', ')
  return { label, secondaryLabel }
}

/**
 * Adapter para o Nominatim (OpenStreetMap) — serviço público e gratuito, sem
 * necessidade de chave. Uso sujeito à política de limite de requisições do
 * OSM (https://operations.osmfoundation.org/policies/nominatim/).
 *
 * Testado empiricamente (ver relatório): é a única das duas fontes com
 * cobertura real de ESTABELECIMENTOS/POIs (shopping, mercado, restaurante,
 * posto, academia) para Goiânia — o MapTiler (abaixo) não tem esses dados
 * neste plano. Em compensação, busca por token completo, não por prefixo
 * ("Flamboy" não encontra "Flamboyant" sozinho) — por isso é combinado com o
 * MapTiler no CombinedGeocodingProvider, não usado isoladamente por padrão.
 */
class NominatimGeocodingProvider implements GeocodingProvider {
  isConfigured = true

  constructor(private readonly baseUrl: string) {}

  async search(query: string): Promise<GeocodingResult[]> {
    const { southWest, northEast } = SUPPORTED_REGION.bounds
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: '5',
      viewbox: `${southWest.lng},${northEast.lat},${northEast.lng},${southWest.lat}`,
      bounded: '1',
    })

    const response = await fetch(`${this.baseUrl}/search?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) {
      throw new Error('Não foi possível buscar o endereço agora. Tente novamente.')
    }

    const results = (await response.json()) as NominatimResult[]
    return results.map((result) => {
      const { label, secondaryLabel } = describeNominatimResult(result)
      return { label, secondaryLabel, point: { lng: Number(result.lon), lat: Number(result.lat) } }
    })
  }

  async reverseGeocode(point: LngLat): Promise<string | null> {
    try {
      const params = new URLSearchParams({ lat: String(point.lat), lon: String(point.lng), format: 'json' })
      const response = await fetch(`${this.baseUrl}/reverse?${params.toString()}`, {
        headers: { Accept: 'application/json' },
      })
      if (!response.ok) return null
      const result = (await response.json()) as NominatimResult
      return result.display_name ?? null
    } catch {
      return null
    }
  }
}

interface MapTilerFeature {
  place_name: string
  text: string
  place_type: string[]
  center: [number, number]
}

interface MapTilerGeocodingResponse {
  features: MapTilerFeature[]
}

const MAPTILER_PLACE_TYPE_LABEL: Record<string, string> = {
  address: 'Endereço',
  street: 'Rua',
  neighbourhood: 'Bairro',
  place: 'Localidade',
  municipality: 'Cidade',
  region: 'Estado',
}

function describeMapTilerFeature(feature: MapTilerFeature): { label: string; secondaryLabel: string } {
  const parts = feature.place_name.split(',').map((part) => part.trim())
  const label = feature.text || parts[0] || feature.place_name
  const type = feature.place_type?.[0]
  const category = type ? MAPTILER_PLACE_TYPE_LABEL[type] : undefined
  const place = parts.length > 1 ? parts[parts.length - 2] : ''
  const secondaryLabel = category && place ? `${category} · ${place}` : parts.slice(1, 3).join(', ')
  return { label, secondaryLabel }
}

/**
 * Adapter para a Geocoding API do MapTiler — mesma chave já usada para o
 * mapa base. Faz busca por PREFIXO (`autocomplete=true`), diferente do
 * Nominatim — ótimo para endereços/ruas/bairros enquanto o usuário digita.
 *
 * Limitação real confirmada em teste (ver relatório): este plano do MapTiler
 * não tem base de estabelecimentos/POIs para Goiânia — buscas genéricas como
 * "shopping" retornam zero resultados mesmo sem nenhum filtro nosso. Por
 * isso não é usado isoladamente; ver CombinedGeocodingProvider.
 */
class MapTilerGeocodingProvider implements GeocodingProvider {
  isConfigured = true

  constructor(private readonly apiKey: string) {}

  async search(query: string): Promise<GeocodingResult[]> {
    const { southWest, northEast } = SUPPORTED_REGION.bounds
    const params = new URLSearchParams({
      key: this.apiKey,
      autocomplete: 'true',
      language: 'pt',
      limit: '5',
      bbox: `${southWest.lng},${southWest.lat},${northEast.lng},${northEast.lat}`,
      proximity: `${SUPPORTED_REGION.center.lng},${SUPPORTED_REGION.center.lat}`,
    })

    const response = await fetch(`https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?${params.toString()}`)

    if (!response.ok) {
      throw new Error('Não foi possível buscar o endereço agora. Tente novamente.')
    }

    const data = (await response.json()) as MapTilerGeocodingResponse
    return (data.features ?? []).map((feature) => {
      const { label, secondaryLabel } = describeMapTilerFeature(feature)
      return { label, secondaryLabel, point: { lng: feature.center[0], lat: feature.center[1] } }
    })
  }

  async reverseGeocode(point: LngLat): Promise<string | null> {
    try {
      const params = new URLSearchParams({ key: this.apiKey, language: 'pt' })
      const response = await fetch(`https://api.maptiler.com/geocoding/${point.lng},${point.lat}.json?${params.toString()}`)
      if (!response.ok) return null
      const data = (await response.json()) as MapTilerGeocodingResponse
      return data.features?.[0]?.place_name ?? null
    } catch {
      return null
    }
  }
}

/**
 * Mesma origem, pelo mesmo motivo do enriquecimento de rota (ver
 * api/overpass.ts): a instância pública serve as respostas de ERRO sem
 * cabeçalho CORS, e o navegador entrega ao código um "Failed to fetch" sem
 * status. Aqui a consequência é mais discreta — a busca de POIs perde uma das
 * fontes em silêncio — mas a causa é a mesma, e as duas usam o mesmo
 * orçamento de dois slots por IP.
 */
const OVERPASS_BASE_URL = '/api/overpass'
const OVERPASS_POI_TIMEOUT_S = 8
/**
 * Teto curto e agressivo do lado do cliente para a busca. Medido: Mapbox
 * responde em ~720ms e Nominatim em ~900ms, mas o Overpass oscila entre
 * responder rápido, devolver HTML de erro (406) e ficar completamente
 * inacessível. Como o CombinedPoiProvider espera as três fontes, sem este
 * teto o Overpass sozinho definia a latência da busca inteira.
 *
 * 3,5s é o suficiente para ele contribuir quando está saudável, e curto o
 * bastante para não estragar a experiência quando não está. Ele é uma fonte
 * COMPLEMENTAR — Mapbox e Nominatim já cobrem a maioria dos casos.
 */
const OVERPASS_SEARCH_CLIENT_TIMEOUT_MS = 3500
/** Chaves de tag OSM usadas para reconhecer um nó/via como um estabelecimento nomeado (não apenas uma via/endereço). */
const OVERPASS_POI_TAG_KEYS = ['shop', 'amenity', 'leisure', 'tourism', 'office', 'healthcare'] as const

const OVERPASS_CATEGORY_LABEL: Record<string, string> = {
  supermarket: 'Supermercado',
  convenience: 'Loja de conveniência',
  mall: 'Shopping',
  department_store: 'Loja de departamento',
  clothes: 'Loja de roupas',
  restaurant: 'Restaurante',
  fast_food: 'Restaurante',
  cafe: 'Cafeteria',
  bar: 'Bar',
  bakery: 'Padaria',
  fuel: 'Posto de combustível',
  fitness_centre: 'Academia',
  gym: 'Academia',
  hospital: 'Hospital',
  clinic: 'Clínica',
  pharmacy: 'Farmácia',
  dentist: 'Dentista',
  bank: 'Banco',
  hotel: 'Hotel',
  hairdresser: 'Salão de beleza',
  car_repair: 'Oficina mecânica',
  university: 'Universidade',
  school: 'Escola',
}

interface OverpassPoiElement {
  type: 'node' | 'way'
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

interface OverpassPoiResponse {
  elements: OverpassPoiElement[]
}

/** Escapa o texto do usuário para uso seguro dentro de um regex Overpass QL entre aspas duplas. */
function escapeOverpassRegex(value: string): string {
  const regexEscaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return regexEscaped.replace(/"/g, '\\"')
}

function describeOverpassElement(tags: Record<string, string>): { label: string; secondaryLabel: string } {
  const label = tags.name ?? 'Local'
  const categoryKey = OVERPASS_POI_TAG_KEYS.map((key) => tags[key]).find(Boolean)
  const secondaryLabel = (categoryKey && OVERPASS_CATEGORY_LABEL[categoryKey]) || 'Ponto de interesse'
  return { label, secondaryLabel }
}

const overpassPoiCache = new Map<string, Promise<GeocodingResult[]>>()

/**
 * Provedor complementar de POIs via Overpass API (mesmo serviço já usado em
 * services/routing/segmentEnrichment.ts para classificar vias — sem
 * dependência nova). Existe porque o Nominatim só casa por PALAVRA
 * completa no nome ("Flor" não encontra "Florênça"), enquanto o Overpass
 * casa por REGEX livre em qualquer trecho do nome, sobre qualquer categoria
 * de estabelecimento (shop/amenity/leisure/tourism/office/healthcare) — não
 * apenas os poucos tipos que o Nominatim prioriza por "importância". Testado
 * empiricamente (ver relatório): encontra POIs pequenos/independentes que
 * nem Nominatim nem MapTiler retornam para buscas parciais.
 *
 * Compromisso aceito: mais lento que os outros dois provedores (a API
 * pública do Overpass não foi feita para autocomplete). Por isso nunca é
 * usado sozinho — apenas como uma fonte a mais dentro do
 * CombinedGeocodingProvider, com timeout do lado do servidor e sem derrubar
 * a busca caso falhe (mesmo padrão de resiliência do restante do app).
 */
class OverpassPoiProvider implements PoiProvider {
  isConfigured = true

  async search(query: string): Promise<GeocodingResult[]> {
    const trimmed = query.trim()
    if (trimmed.length < 3) return []

    const cacheKey = trimmed.toLowerCase()
    const cached = overpassPoiCache.get(cacheKey)
    if (cached) return cached

    const { southWest, northEast } = SUPPORTED_REGION.bounds
    const bbox = `${southWest.lat},${southWest.lng},${northEast.lat},${northEast.lng}`
    const pattern = escapeOverpassRegex(trimmed)
    const clauses = OVERPASS_POI_TAG_KEYS.flatMap((key) => [
      `node["name"~"${pattern}",i]["${key}"](${bbox});`,
      `way["name"~"${pattern}",i]["${key}"](${bbox});`,
    ]).join('')
    const ql = `[out:json][timeout:${OVERPASS_POI_TIMEOUT_S}];(${clauses});out center 10;`

    // Só entra no cache o resultado de uma resposta BEM-SUCEDIDA — o servidor
    // público do Overpass tem limite de taxa compartilhado e pode responder
    // 429/504 sob carga (confirmado em teste). Cachear a falha faria a busca
    // ficar "presa" sem resultados de POI pelo resto da sessão mesmo depois
    // do limite liberar; assim, uma tentativa mal-sucedida sempre pode ser
    // repetida na próxima busca pelo mesmo termo.
    // O `[timeout:N]` acima é uma instrução para o PRÓPRIO Overpass abortar o
    // processamento da consulta — não cobre lentidão de rede/fila antes
    // disso, então sem um limite do lado do cliente uma resposta que nunca
    // chega (confirmado em teste: servidor público sem responder) trava a
    // busca inteira indefinidamente, já que Promise.allSettled espera todas
    // as fontes. AbortController garante que essa fonte sempre desiste a
    // tempo, mesmo quando o servidor simplesmente não responde nada.
    const abortController = new AbortController()
    const abortTimer = setTimeout(() => abortController.abort(), OVERPASS_SEARCH_CLIENT_TIMEOUT_MS)
    try {
      const response = await fetch(OVERPASS_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: ql,
        signal: abortController.signal,
      })
      if (!response.ok) throw new Error('Overpass POI request failed')
      const data = (await response.json()) as OverpassPoiResponse
      const results = (data.elements ?? [])
        .filter((element) => element.tags?.name)
        .map((element) => {
          const point =
            element.type === 'node'
              ? { lat: element.lat as number, lng: element.lon as number }
              : { lat: (element.center as { lat: number; lon: number }).lat, lng: (element.center as { lat: number; lon: number }).lon }
          const { label, secondaryLabel } = describeOverpassElement(element.tags as Record<string, string>)
          return { label, secondaryLabel, point }
        })
      overpassPoiCache.set(cacheKey, Promise.resolve(results))
      return results
    } catch {
      return []
    } finally {
      clearTimeout(abortTimer)
    }
  }
}

/** Distância mínima para considerar dois resultados "o mesmo lugar" ao mesclar as fontes. */
const DEDUPE_DISTANCE_METERS = 40
const MAX_COMBINED_RESULTS = 8

/**
 * Relevância textual simples do resultado em relação ao que o usuário
 * digitou — usada para REORDENAR a lista combinada (não apenas concatenar
 * "MapTiler primeiro, Nominatim depois"). Sem isso, o primeiro resultado da
 * lista combinada podia ser um endereço de rua pouco relevante em vez do
 * estabelecimento que o usuário realmente procurava (ex: "Flamboyant
 * Shopping" resolvendo para "Rua Flamboyant" em vez do shopping em si) —
 * problema real encontrado em teste, não hipotético.
 */
function relevanceScore(label: string, query: string): number {
  const labelLower = label.toLowerCase()
  const queryLower = query.toLowerCase().trim()
  if (labelLower === queryLower) return 100
  if (labelLower.startsWith(queryLower)) return 80
  if (labelLower.includes(queryLower)) return 60

  // Remove pontuação (vírgulas etc.) antes de tokenizar — sem isso, "Shopping,"
  // nunca batia com "Shopping" no rótulo, penalizando resultados corretos
  // sempre que a busca vinha com vírgula (ex: "Flamboyant Shopping, Goiânia").
  const queryWords = queryLower
    .replace(/[,.]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (queryWords.length === 0) return 0
  const matchedWords = queryWords.filter((word) => labelLower.includes(word)).length
  return (matchedWords / queryWords.length) * 40
}

interface MapboxSearchFeature {
  properties: {
    name: string
    place_formatted?: string
    poi_category?: string[]
  }
  geometry: { coordinates: [number, number] }
}

interface MapboxSearchResponse {
  features: MapboxSearchFeature[]
}

const MAPBOX_CATEGORY_LABEL: Record<string, string> = {
  grocery: 'Supermercado',
  convenience_store: 'Loja de conveniência',
  shopping_mall: 'Shopping',
  clothing_store: 'Loja de roupas',
  restaurant: 'Restaurante',
  fast_food_restaurant: 'Restaurante',
  cafe: 'Cafeteria',
  bar: 'Bar',
  bakery: 'Padaria',
  gas_station: 'Posto de combustível',
  gym: 'Academia',
  fitness_center: 'Academia',
  hospital: 'Hospital',
  clinic: 'Clínica',
  medical_clinic: 'Clínica',
  pharmacy: 'Farmácia',
  dentist: 'Dentista',
  bank: 'Banco',
  hotel: 'Hotel',
  hair_salon: 'Salão de beleza',
  car_repair: 'Oficina mecânica',
  school: 'Escola',
  university: 'Universidade',
}

function describeMapboxFeature(feature: MapboxSearchFeature): { label: string; secondaryLabel: string } {
  const label = feature.properties.name
  const categoryKey = feature.properties.poi_category?.[0]
  const categoryLabel = categoryKey ? MAPBOX_CATEGORY_LABEL[categoryKey] : undefined
  const place = feature.properties.place_formatted ?? ''
  const secondaryLabel = categoryLabel ? `${categoryLabel}${place ? ` · ${place}` : ''}` : place || 'Ponto de interesse'
  return { label, secondaryLabel }
}

/**
 * Provedor complementar PAGO (Mapbox Search Box API) — só ativo quando
 * VITE_MAPBOX_API_KEY está definida no .env; sem a chave, isConfigured fica
 * false e o app continua funcionando só com Nominatim+Overpass (gratuitos).
 *
 * Existe porque testes reais (ver relatório de auditoria de busca)
 * confirmaram que Nominatim/Overpass — ambos sobre a mesma base OSM — não
 * têm vários estabelecimentos reais de Goiânia/Aparecida de Goiânia que o
 * Mapbox tem numa base própria (ex.: "Posto Líder", "Be Honest", "Hospital
 * Garavelo", nenhum dos três presente no OSM da região, confirmado por
 * consulta direta). `bbox` restringe geometricamente à região atendida —
 * sem isso, nomes comuns como "Posto Líder" retornam unidades de outros
 * estados primeiro (testado e confirmado). Mesmo assim não é fonte
 * completa — uma unidade específica de rede pode faltar mesmo aqui — por
 * isso continua sendo um COMPLEMENTO, nunca a única fonte.
 */
class MapboxPoiProvider implements PoiProvider {
  isConfigured = true

  constructor(private readonly accessToken: string) {}

  async search(query: string): Promise<GeocodingResult[]> {
    const trimmed = query.trim()
    if (trimmed.length < 3) return []

    const { southWest, northEast } = SUPPORTED_REGION.bounds
    const params = new URLSearchParams({
      q: trimmed,
      access_token: this.accessToken,
      language: 'pt',
      country: 'BR',
      limit: '5',
      types: 'poi',
      bbox: `${southWest.lng},${southWest.lat},${northEast.lng},${northEast.lat}`,
      proximity: `${SUPPORTED_REGION.center.lng},${SUPPORTED_REGION.center.lat}`,
    })

    const abortController = new AbortController()
    const abortTimer = setTimeout(() => abortController.abort(), 6000)
    try {
      const response = await fetch(`https://api.mapbox.com/search/searchbox/v1/forward?${params.toString()}`, {
        signal: abortController.signal,
      })
      if (!response.ok) return []
      const data = (await response.json()) as MapboxSearchResponse
      return (data.features ?? []).map((feature) => {
        const { label, secondaryLabel } = describeMapboxFeature(feature)
        const [lng, lat] = feature.geometry.coordinates
        return { label, secondaryLabel, point: { lng, lat } }
      })
    } catch {
      return []
    } finally {
      clearTimeout(abortTimer)
    }
  }
}

/** Bônus de um resultado do Overpass sobre um resultado do Nominatim dentro do PoiProvider — ambos já são POIs de verdade, mas o Overpass casa por trecho do nome (mais preciso quando bate), enquanto o Nominatim também retorna bairros/localidades misturados junto com estabelecimentos. */
const OVERPASS_OVER_NOMINATIM_BONUS = 10
/** Bônus do Mapbox — quando presente, tende a ser o resultado mais preciso (base curada, não só OSM) e é frequentemente a única fonte que tem o estabelecimento. */
const MAPBOX_OVER_NOMINATIM_BONUS = 12
/** Bônus de qualquer resultado do PoiProvider (estabelecimento real) sobre um resultado puro de endereço/rua do GeocodingProvider — ver CombinedGeocodingProvider. */
const POI_OVER_ADDRESS_BONUS = 15

/**
 * Combina Nominatim, Overpass e (se configurado) Mapbox — as fontes de POI
 * disponíveis — numa única lista de estabelecimentos. Implementa
 * PoiProvider, não GeocodingProvider: não resolve endereço/rua, só locais
 * nomeados.
 */
class CombinedPoiProvider implements PoiProvider {
  isConfigured = true

  constructor(
    private readonly nominatim: NominatimGeocodingProvider,
    private readonly overpass: OverpassPoiProvider,
    private readonly mapbox: MapboxPoiProvider | null,
  ) {}

  async search(query: string): Promise<GeocodingResult[]> {
    const [nominatimOutcome, overpassOutcome, mapboxOutcome] = await Promise.allSettled([
      this.nominatim.search(query),
      this.overpass.search(query),
      this.mapbox ? this.mapbox.search(query) : Promise.resolve([]),
    ])

    const nominatimResults = nominatimOutcome.status === 'fulfilled' ? nominatimOutcome.value : []
    const overpassResults = overpassOutcome.status === 'fulfilled' ? overpassOutcome.value : []
    const mapboxResults = mapboxOutcome.status === 'fulfilled' ? mapboxOutcome.value : []

    const combined: { result: GeocodingResult; bonus: number }[] = nominatimResults.map((result) => ({ result, bonus: 0 }))
    for (const candidate of overpassResults) {
      const isDuplicate = combined.some((existing) => haversineDistanceMeters(existing.result.point, candidate.point) < DEDUPE_DISTANCE_METERS)
      if (!isDuplicate) combined.push({ result: candidate, bonus: OVERPASS_OVER_NOMINATIM_BONUS })
    }
    for (const candidate of mapboxResults) {
      const isDuplicate = combined.some((existing) => haversineDistanceMeters(existing.result.point, candidate.point) < DEDUPE_DISTANCE_METERS)
      if (!isDuplicate) combined.push({ result: candidate, bonus: MAPBOX_OVER_NOMINATIM_BONUS })
    }

    const allFailed =
      nominatimOutcome.status === 'rejected' && overpassOutcome.status === 'rejected' && mapboxOutcome.status === 'rejected'
    if (combined.length === 0 && allFailed) {
      throw new Error('Não foi possível buscar estabelecimentos agora. Tente novamente.')
    }

    const withScore = combined.map((entry, index) => ({
      result: entry.result,
      index,
      score: relevanceScore(entry.result.label, query) + entry.bonus,
    }))
    withScore.sort((a, b) => b.score - a.score || a.index - b.index)

    return withScore.map((entry) => entry.result)
  }
}

/**
 * Combina um GeocodingProvider de endereço (MapTiler — prefixo, ruas/bairros)
 * com um PoiProvider de estabelecimentos numa única lista de sugestões —
 * nenhum dos dois isoladamente cobre bem os dois casos de uso (ver
 * comentários das classes acima). Falha de uma das fontes não derruba a
 * busca: usa o que a outra retornou.
 */
class CombinedGeocodingProvider implements GeocodingProvider {
  isConfigured = true

  constructor(
    private readonly addressProvider: GeocodingProvider,
    private readonly poiProvider: PoiProvider,
    private readonly reverseGeocodeFallback: GeocodingProvider,
  ) {}

  async search(query: string): Promise<GeocodingResult[]> {
    const [addressOutcome, poiOutcome] = await Promise.allSettled([
      this.addressProvider.search(query),
      this.poiProvider.search(query),
    ])

    const addressResults = addressOutcome.status === 'fulfilled' ? addressOutcome.value : []
    const poiResults = poiOutcome.status === 'fulfilled' ? poiOutcome.value : []

    // Um estabelecimento real (PoiProvider) ganha um bônus sobre um endereço
    // puro (GeocodingProvider) em caso de empate textual — sem isso, "Flor"
    // bate igualmente em "Rua Flor da Acácia" e em "Florênça" (a farmácia), e
    // a rua ocupava a vaga na lista enquanto o estabelecimento nunca
    // aparecia — bug real encontrado em teste (ver relatório), não hipotético.
    const combined: { result: GeocodingResult; sourceBonus: number }[] = addressResults.map((result) => ({ result, sourceBonus: 0 }))
    for (const candidate of poiResults) {
      const isDuplicate = combined.some((existing) => haversineDistanceMeters(existing.result.point, candidate.point) < DEDUPE_DISTANCE_METERS)
      if (!isDuplicate) combined.push({ result: candidate, sourceBonus: POI_OVER_ADDRESS_BONUS })
    }

    const allFailed = addressOutcome.status === 'rejected' && poiOutcome.status === 'rejected'
    if (combined.length === 0 && allFailed) {
      throw new Error('Não foi possível buscar o endereço agora. Tente novamente.')
    }

    // Ordenação estável por relevância — preserva a ordem original entre
    // empates, mas garante que o melhor match textual (mais o bônus de
    // fonte) apareça primeiro, independente de qual fonte o encontrou.
    const withScore = combined.map((entry, index) => ({
      result: entry.result,
      index,
      score: relevanceScore(entry.result.label, query) + entry.sourceBonus,
    }))
    withScore.sort((a, b) => b.score - a.score || a.index - b.index)

    return withScore.slice(0, MAX_COMBINED_RESULTS).map((entry) => entry.result)
  }

  async reverseGeocode(point: LngLat): Promise<string | null> {
    return (await this.addressProvider.reverseGeocode(point)) ?? this.reverseGeocodeFallback.reverseGeocode(point)
  }
}

/**
 * Ponto único de troca do provedor de POI/estabelecimentos — usado por
 * getGeocodingProvider() abaixo. O Mapbox entra automaticamente quando
 * VITE_MAPBOX_API_KEY está definida no .env; sem a chave, cai de volta para
 * só Nominatim+Overpass (gratuitos) sem nenhuma mudança de comportamento.
 */
function getPoiProvider(): PoiProvider {
  const mapbox = env.mapboxApiKey ? new MapboxPoiProvider(env.mapboxApiKey) : null
  return new CombinedPoiProvider(new NominatimGeocodingProvider(env.geocodingBaseUrl), new OverpassPoiProvider(), mapbox)
}

export function getGeocodingProvider(): GeocodingProvider {
  // Prioridade: override explícito > MapTiler+POI combinados (padrão) > Nominatim isolado (fallback sem chave do MapTiler).
  if (env.geocodingBaseUrlOverride) {
    return new NominatimGeocodingProvider(env.geocodingBaseUrlOverride)
  }
  if (env.maptilerApiKey) {
    return new CombinedGeocodingProvider(
      new MapTilerGeocodingProvider(env.maptilerApiKey),
      getPoiProvider(),
      new NominatimGeocodingProvider(env.geocodingBaseUrl),
    )
  }
  if (!isGeocodingConfigured) {
    return new UnconfiguredGeocodingProvider()
  }
  return new NominatimGeocodingProvider(env.geocodingBaseUrl)
}
