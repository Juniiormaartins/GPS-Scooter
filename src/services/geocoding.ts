import { env, isGeocodingConfigured } from '@/config/env'
import { SUPPORTED_REGION, type LngLat } from '@/config/region'
import { haversineDistanceMeters } from '@/utils/geo'

import { POI_FALLBACK, poiCategoryForClass, resolvePoiCategory, type PoiCategory } from '@/components/map/poiLibrary'
import { foldText, parseIntent, type ParsedIntent } from '@/services/search/placeIntent'
import { isSamePlace, mergeInto } from '@/services/search/dedupe'
import { rankCandidates, type RankCandidate } from '@/services/search/ranking'

export interface GeocodingResult {
  label: string
  /**
   * Categoria da biblioteca de POIs, para a lista de resultados mostrar o
   * mesmo ícone que o lugar tem no mapa.
   *
   * Vem de `poiCategoryForClass`, o MESMO caminho que a camada do mapa usa —
   * inclusive a regra de fallback. Sem isto, cada resultado da busca saía com
   * um alfinete genérico e o usuário não conseguia distinguir uma farmácia de
   * um posto na lista, mesmo com a biblioteca sabendo a diferença.
   */
  poiCategory?: PoiCategory
  /** Cidade/bairro ou categoria do local, quando disponível — para exibição em duas linhas na UI. */
  secondaryLabel?: string
  point: LngLat
  /** True quando a sugestão veio do histórico local, não de um provedor externo — a UI marca essas com ícone de relógio. */
  fromHistory?: boolean
  /**
   * True quando o resultado é uma ÁREA (bairro, localidade, cidade, estado) e
   * não um ponto endereçável.
   *
   * Serve a uma coisa só: barrar a adoção de categoria. O centro de um bairro
   * cai perto de dezenas de estabelecimentos, então por proximidade ele
   * "herdaria" a categoria de qualquer um deles — foi o que aconteceu com o
   * bairro Vila Brasília, que apareceu com badge de ônibus por causa do
   * terminal. Bairro não é estabelecimento, e nenhuma distância muda isso.
   */
  isArea?: boolean
  /**
   * Uso interno da ordenação: o resultado veio de uma busca por CATEGORIA e é do
   * tipo pedido ("farmácia" → uma farmácia de verdade, não uma rua com o nome).
   * A interface não lê isto; só `ranking.ts`.
   */
  intentMatch?: boolean
}

/**
 * Opções de uma busca.
 *
 * `near` é a posição do USUÁRIO. Antes nenhuma fonte a recebia — a
 * "proximidade" enviada ao MapTiler era o centro fixo da cidade, e o
 * Nominatim/Overpass buscavam na região inteira. É por isso que digitar
 * "farmácia" trazia uma a 7 km antes de uma a 2 km.
 *
 * `onPartial` entrega a lista PARCIAL conforme cada fonte responde. As fontes
 * têm velocidades muito diferentes (Nominatim ~1 s, categoria no Overpass 10–30
 * s), e esperar a mais lenta para mostrar qualquer coisa seria trocar uma
 * lista boa em 1 s por uma excelente em 20.
 */
export interface SearchOptions {
  near?: LngLat | null
  onPartial?: (results: GeocodingResult[]) => void
}

/**
 * ADOTA a categoria do duplicado descartado.
 *
 * PROBLEMA REAL. A deduplicação escolhia um vencedor por proximidade e jogava
 * fora o resto — inclusive a CATEGORIA. Quem sobrevive costuma ser o resultado
 * de ENDEREÇO (MapTiler/Nominatim), que não tem categoria nenhuma: medido, a
 * geocodificação do MapTiler devolve `kind: "street"` para "Terminal Vila
 * Brasília" e nada mais. O resultado do Overpass, esse SIM com a tag
 * `amenity=bus_station`, era descartado por estar a poucos metros.
 *
 * Daí o sintoma: no mapa o terminal aparece com o badge de ônibus, e na busca
 * o mesmo lugar aparece com alfinete genérico. Não era mapeamento errado — era
 * a categoria certa sendo jogada fora na hora de unir as listas.
 *
 * A adoção é UNILATERAL: só preenche quem está sem categoria. Um resultado que
 * já tem a sua nunca é sobrescrito por um vizinho.
 */
function adoptCategory(survivor: GeocodingResult, discarded: GeocodingResult): void {
  if (survivor.isArea) return
  if (survivor.poiCategory == null && discarded.poiCategory != null) {
    survivor.poiCategory = discarded.poiCategory
  }
}

export interface GeocodingProvider {
  isConfigured: boolean
  search(query: string, options?: SearchOptions): Promise<GeocodingResult[]>
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
  search(query: string, options?: SearchOptions): Promise<GeocodingResult[]>
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

/**
 * Classes do Nominatim que descrevem um ESTABELECIMENTO.
 *
 * O Nominatim usa o vocabulário cru do OSM, onde `class` é a chave da tag e
 * `type` é o valor. Nesse vocabulário convivem POIs (`amenity=pharmacy`),
 * VIAS (`highway=service`), áreas (`landuse=residential`) e limites
 * administrativos (`boundary=administrative`) — todos no mesmo formato.
 *
 * Só as chaves desta lista descrevem um lugar que faz sentido ter badge. O
 * resto é endereço ou geografia, e a lista mostra alfinete, que é o símbolo de
 * "um ponto no mapa" e não de "um estabelecimento deste tipo".
 *
 * `highway` fica DE FORA de propósito, e é o caso que originou a regra: numa
 * busca por "Terminal Vila Brasília" o Nominatim devolve `highway=service`
 * (a via de acesso do terminal) antes das plataformas, e `service` na tabela
 * de POIs é a categoria de oficinas — o lugar aparecia com badge de serviços
 * na busca e badge de ônibus no mapa.
 */
const NOMINATIM_POI_CLASSES = new Set([
  'amenity',
  'shop',
  'leisure',
  'tourism',
  'office',
  'healthcare',
  'craft',
  'emergency',
  'historic',
  'club',
  'sport',
  'aeroway',
])

/** Classes do Nominatim que descrevem uma ÁREA, não um ponto — ver `isArea`. */
const NOMINATIM_AREA_CLASSES = new Set(['place', 'boundary', 'landuse', 'natural'])

function describeNominatimResult(result: NominatimResult): {
  label: string
  secondaryLabel: string
  poiCategory?: PoiCategory
  isArea: boolean
} {
  const parts = result.display_name.split(',').map((part) => part.trim())
  const label = parts[0] ?? result.display_name
  const category = result.type ? NOMINATIM_CATEGORY_LABEL[result.type] : undefined
  const place = parts.length > 2 ? parts[parts.length - 3] : parts[parts.length - 1]
  const secondaryLabel = category ? `${category} · ${place}` : parts.slice(1, 3).join(', ')
  // O Nominatim devolve `class` (amenity, shop…) e `type` (pharmacy, cafe…).
  // O `type` é o que corresponde à `class` do vocabulário do MapTiler, então
  // ele vai primeiro; a `class` entra como segunda tentativa.
  //
  // Dentro de uma classe de POI o fallback VALE: `amenity=marketplace` sem
  // equivalência na tabela ainda é um estabelecimento, e badge genérico é a
  // resposta certa. Fora dela não há badge nenhum.
  const isPoi = result.class ? NOMINATIM_POI_CLASSES.has(result.class) : false
  const poiCategory = isPoi ? resolvePoiCategory(result.type, result.class) ?? POI_FALLBACK : undefined
  const isArea = result.class ? NOMINATIM_AREA_CLASSES.has(result.class) : false
  return { label, secondaryLabel, poiCategory, isArea }
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
/**
 * Espaçamento entre consultas ao Nominatim público.
 *
 * A política de uso pede no máximo ~1 requisição por segundo. A busca agora faz
 * duas (região inteira, para nomes específicos distantes, e a vizinhança do
 * usuário, para termos genéricos), então elas passam por esta fila de 1,1 s em
 * vez de saírem juntas.
 */
let nominatimLiberadoEm = 0
async function nominatimGate(): Promise<void> {
  const agora = Date.now()
  const espera = Math.max(0, nominatimLiberadoEm - agora)
  nominatimLiberadoEm = Math.max(agora, nominatimLiberadoEm) + 1100
  if (espera > 0) await new Promise((resolve) => setTimeout(resolve, espera))
}

const nominatimNearbyCache = new Map<string, { at: number; promise: Promise<GeocodingResult[]> }>()

/** Meia-largura da vizinhança consultada em volta do usuário, em graus (~7,7 km). */
const NEARBY_HALF_SPAN_DEG = 0.07

class NominatimGeocodingProvider implements GeocodingProvider {
  isConfigured = true

  constructor(private readonly baseUrl: string) {}

  /**
   * A VIZINHANÇA do usuário, com limite geográfico FIRME.
   *
   * Medido: com a restrição solta (`bounded=0`) o Nominatim devolve, para
   * "farmacia", lugares chamados "Farmacia" a 935 km — o viewbox sozinho é um
   * empurrão fraco. Com `bounded=1` e a caixa em volta de quem busca, a mesma
   * consulta devolve Drogasil a 304 m, Drogaria Zarpoli a 496 m.
   *
   * Pede 20, não 5: a lista é reordenada por distância depois, e as 5 de
   * "maior importância" nem sempre são as 5 mais próximas.
   *
   * Com uma INTENÇÃO (categoria), descarta o que não é do tipo: o Nominatim
   * responde "banco" com bancos de praça (`amenity=bench`).
   */
  async searchNearby(query: string, near: LngLat, parsed: ParsedIntent | null): Promise<GeocodingResult[]> {
    // A pessoa digita "farm", "farma", "farmac"… e cada pausa dispara uma busca
    // IGUAL (todas viram o termo "farmacia"). Sem este cache, são várias
    // consultas idênticas a um serviço que pede no máximo uma por segundo.
    const chave = `${parsed ? `${parsed.term} ${parsed.nameFilter}` : query}|${near.lat.toFixed(2)},${near.lng.toFixed(2)}`
    const emMemoria = nominatimNearbyCache.get(chave)
    if (emMemoria && Date.now() - emMemoria.at < 120_000) return emMemoria.promise
    const promise = this.fetchNearby(query, near, parsed)
    nominatimNearbyCache.set(chave, { at: Date.now(), promise })
    promise.catch(() => nominatimNearbyCache.delete(chave))
    return promise
  }

  private async fetchNearby(query: string, near: LngLat, parsed: ParsedIntent | null): Promise<GeocodingResult[]> {
    await nominatimGate()
    const d = NEARBY_HALF_SPAN_DEG
    const params = new URLSearchParams({
      q: parsed ? `${parsed.term} ${parsed.nameFilter}`.trim() : query,
      format: 'json',
      limit: '20',
      viewbox: `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`,
      bounded: '1',
    })

    const response = await fetch(`${this.baseUrl}/search?${params.toString()}`, { headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error('Nominatim indisponível')

    const tipos = parsed ? new Set(parsed.intent.nominatim) : null
    const filtro = parsed?.nameFilter ? foldText(parsed.nameFilter) : ''
    const raw = (await response.json()) as NominatimResult[]
    return raw
      .filter((result) => !tipos || tipos.has(`${result.class}:${result.type}`))
      .filter((result) => !filtro || foldText(result.display_name.split(',')[0]).includes(filtro))
      .map((result) => {
        const { label, secondaryLabel, poiCategory, isArea } = describeNominatimResult(result)
        return {
          label,
          secondaryLabel,
          poiCategory,
          isArea,
          intentMatch: parsed != null,
          point: { lng: Number(result.lon), lat: Number(result.lat) },
        }
      })
  }

  async search(query: string): Promise<GeocodingResult[]> {
    await nominatimGate()
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
      const { label, secondaryLabel, poiCategory, isArea } = describeNominatimResult(result)
      return { label, secondaryLabel, poiCategory, isArea, point: { lng: Number(result.lon), lat: Number(result.lat) } }
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

/** Tipos do MapTiler que descrevem uma ÁREA, não um ponto — ver `isArea`. */
const MAPTILER_AREA_TYPES = new Set(['neighbourhood', 'place', 'municipality', 'region', 'country'])

function describeMapTilerFeature(feature: MapTilerFeature): { label: string; secondaryLabel: string; isArea: boolean } {
  const parts = feature.place_name.split(',').map((part) => part.trim())
  const label = feature.text || parts[0] || feature.place_name
  const type = feature.place_type?.[0]
  const category = type ? MAPTILER_PLACE_TYPE_LABEL[type] : undefined
  const place = parts.length > 1 ? parts[parts.length - 2] : ''
  const secondaryLabel = category && place ? `${category} · ${place}` : parts.slice(1, 3).join(', ')
  return { label, secondaryLabel, isArea: type ? MAPTILER_AREA_TYPES.has(type) : false }
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

  async search(query: string, options: SearchOptions = {}): Promise<GeocodingResult[]> {
    const { southWest, northEast } = SUPPORTED_REGION.bounds
    // Proximidade da PESSOA, não do centro da cidade: é o parâmetro que faz o
    // MapTiler preferir a rua da esquina à de mesmo nome do outro lado da cidade.
    const ancora = options.near ?? SUPPORTED_REGION.center
    const params = new URLSearchParams({
      key: this.apiKey,
      autocomplete: 'true',
      language: 'pt',
      limit: '5',
      bbox: `${southWest.lng},${southWest.lat},${northEast.lng},${northEast.lat}`,
      proximity: `${ancora.lng},${ancora.lat}`,
    })

    const response = await fetch(`https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?${params.toString()}`)

    if (!response.ok) {
      throw new Error('Não foi possível buscar o endereço agora. Tente novamente.')
    }

    const data = (await response.json()) as MapTilerGeocodingResponse
    return (data.features ?? []).map((feature) => {
      const { label, secondaryLabel, isArea } = describeMapTilerFeature(feature)
      return { label, secondaryLabel, isArea, point: { lng: feature.center[0], lat: feature.center[1] } }
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
/**
 * Desistência DEFINITIVA da requisição — o caso "o servidor não respondeu
 * nada", que o teto acima não cobre mais desde que ele parou de cancelar.
 *
 * 20s é folgado de propósito: nada aqui bloqueia a tela, e a única coisa que
 * este limite evita é uma requisição pendurada para sempre.
 */
const OVERPASS_HARD_TIMEOUT_MS = 20000
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
  type: 'node' | 'way' | 'relation'
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

function describeOverpassElement(tags: Record<string, string>): {
  label: string
  secondaryLabel: string
  poiCategory: PoiCategory
} {
  const label = tags.name ?? 'Local'
  // O valor da tag (`amenity=pharmacy`, `shop=bakery`) É o vocabulário de
  // classe da biblioteca — passa direto pela mesma função de fallback.
  const categoryKey = OVERPASS_POI_TAG_KEYS.map((key) => tags[key]).find(Boolean)
  const categoria = (categoryKey && OVERPASS_CATEGORY_LABEL[categoryKey]) || 'Ponto de interesse'
  // O ENDEREÇO, quando o OSM o tem: duas "Drogasil" na lista só se distinguem
  // pela rua — e é pela rua que a pessoa reconhece a que está na esquina.
  const rua = tags['addr:street']
  const numero = tags['addr:housenumber']
  const bairro = tags['addr:suburb']
  const endereco = rua ? `${rua}${numero ? `, ${numero}` : ''}` : bairro
  const secondaryLabel = endereco ? `${categoria} · ${endereco}` : categoria
  return { label, secondaryLabel, poiCategory: poiCategoryForClass(categoryKey) }
}

const overpassPoiCache = new Map<string, Promise<GeocodingResult[]>>()

/**
 * Resultados de busca por categoria, guardados no aparelho por uma semana.
 *
 * A consulta é a mais lenta e a mais sujeita a falha de todo o app (o servidor
 * público chega a levar 30 s ou devolver 504), e o conteúdo quase nunca muda:
 * as farmácias em volta de casa de hoje são as de ontem. Guardado, "farmácia"
 * volta na hora na segunda vez — e continua funcionando com o Overpass fora.
 */
const INTENT_CACHE_PREFIX = 'gps-scooter:intent:'
const INTENT_CACHE_FRESH_MS = 7 * 24 * 60 * 60 * 1000
const INTENT_CACHE_MAX_KEYS = 30

function readIntentCache(chave: string): { results: GeocodingResult[]; fresh: boolean } | null {
  try {
    const raw = localStorage.getItem(INTENT_CACHE_PREFIX + chave)
    if (!raw) return null
    const { at, results } = JSON.parse(raw) as { at: number; results: GeocodingResult[] }
    return { results, fresh: Date.now() - at < INTENT_CACHE_FRESH_MS }
  } catch {
    return null
  }
}

function writeIntentCache(chave: string, results: GeocodingResult[]) {
  try {
    localStorage.setItem(INTENT_CACHE_PREFIX + chave, JSON.stringify({ at: Date.now(), results: results.slice(0, 60) }))
    // Sem crescer para sempre: descarta as mais antigas além do limite.
    const chaves = Object.keys(localStorage).filter((k) => k.startsWith(INTENT_CACHE_PREFIX))
    if (chaves.length > INTENT_CACHE_MAX_KEYS) {
      const idade = chaves
        .map((k) => {
          try {
            return { k, at: (JSON.parse(localStorage.getItem(k) ?? '{}') as { at?: number }).at ?? 0 }
          } catch {
            return { k, at: 0 }
          }
        })
        .sort((a, b) => a.at - b.at)
      for (const { k } of idade.slice(0, chaves.length - INTENT_CACHE_MAX_KEYS)) localStorage.removeItem(k)
    }
  } catch {
    // localStorage cheio ou indisponível: sem cache, só isso.
  }
}

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

  /**
   * Caminho RÁPIDO — o que a lista espera.
   *
   * Corre a requisição contra um cronômetro e devolve lista vazia se ela
   * perder. O que NÃO acontece mais: a requisição ser cancelada junto. Ela
   * continua, e quem chega depois (`searchWithoutBudget`) recebe a mesma
   * promessa — uma requisição só, dois consumidores.
   *
   * MEDIDO, e é o que motivou a mudança: a instância pública do Overpass
   * respondeu esta consulta em 3,1s, 3,6s, 9,8s e 11,0s em medições
   * consecutivas. Com o teto de 3,5s e cancelamento junto, o resultado era
   * jogado fora quase sempre — pagávamos a espera e perdíamos a resposta. Era
   * por isso que o Terminal Vila Brasília aparecia sem badge na busca mesmo
   * com o Overpass sabendo que ele é `amenity=bus_station`.
   */
  async search(query: string): Promise<GeocodingResult[]> {
    const trimmed = query.trim()
    if (trimmed.length < 3) return []

    let timer: ReturnType<typeof setTimeout> | undefined
    const budget = new Promise<GeocodingResult[]>((resolve) => {
      timer = setTimeout(() => resolve([]), OVERPASS_SEARCH_CLIENT_TIMEOUT_MS)
    })
    try {
      return await Promise.race([this.request(trimmed), budget])
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  /**
   * BUSCA POR CATEGORIA, em volta do usuário.
   *
   * É a que acha a Droga Raia quando se digita "farmácia": pergunta ao OSM pelas
   * `amenity=pharmacy` num raio, em vez de procurar a palavra no nome. Completa
   * mas lenta (10–30 s no servidor público) — por isso o chamador a trata como
   * fonte que chega DEPOIS, e por isso o resultado fica guardado no aparelho:
   * a farmácia da esquina não muda de uma semana para outra.
   */
  async searchIntent(parsed: ParsedIntent, near: LngLat): Promise<GeocodingResult[]> {
    const chave = `${parsed.intent.id}|${parsed.nameFilter}|${near.lat.toFixed(2)},${near.lng.toFixed(2)}`
    const guardado = readIntentCache(chave)
    if (guardado?.fresh) return guardado.results

    const emMemoria = overpassPoiCache.get(`intent:${chave}`)
    if (emMemoria) return emMemoria

    const promise = this.fetchIntent(parsed, near)
      .then((results) => {
        if (results.length > 0) writeIntentCache(chave, results)
        return results
      })
      .catch((erro) => {
        // Rede falhou: dado velho serve de reserva.
        if (guardado) return guardado.results
        throw erro
      })
    overpassPoiCache.set(`intent:${chave}`, promise)
    promise.catch(() => overpassPoiCache.delete(`intent:${chave}`))
    return promise
  }

  private async fetchIntent(parsed: ParsedIntent, near: LngLat): Promise<GeocodingResult[]> {
    const { intent, nameFilter } = parsed
    const ao = `(around:${intent.radiusM},${near.lat},${near.lng})`
    const nome = nameFilter ? `["name"~"${escapeOverpassRegex(nameFilter)}",i]` : ''
    const clausulas = intent.overpass.map((filtro) => `nwr[${filtro}]${nome}${ao};`)
    if (intent.nameAlt && intent.nameTags && !nameFilter) {
      clausulas.push(
        `nwr["name"~"${intent.nameAlt.replace(/"/g, '\\"')}"]["amenity"~"^(${intent.nameTags})$"]${ao};`,
      )
    }
    const ql = `[out:json][timeout:25];(${clausulas.join('')});out center tags 80;`

    const abortController = new AbortController()
    const abortTimer = setTimeout(() => abortController.abort(), OVERPASS_HARD_TIMEOUT_MS)
    try {
      const response = await fetch(OVERPASS_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: ql,
        signal: abortController.signal,
      })
      if (!response.ok) throw new Error('Overpass (categoria) indisponível')
      const data = (await response.json()) as OverpassPoiResponse
      return (data.elements ?? [])
        // Sem nome não há o que mostrar: "Local" 40 vezes não ajuda ninguém.
        .filter((element) => element.tags?.name)
        .map((element) => {
          const point =
            element.type === 'node'
              ? { lat: element.lat as number, lng: element.lon as number }
              : { lat: (element.center as { lat: number; lon: number }).lat, lng: (element.center as { lat: number; lon: number }).lon }
          const { label, secondaryLabel, poiCategory } = describeOverpassElement(element.tags as Record<string, string>)
          return { label, secondaryLabel, poiCategory, point, intentMatch: true }
        })
    } finally {
      clearTimeout(abortTimer)
    }
  }

  /**
   * Caminho TARDIO — sem cronômetro.
   *
   * Usado por `adoptLatePoiCategories`, depois de a lista já estar na tela.
   * Aqui a espera não custa nada ao usuário: ele já está lendo os resultados.
   */
  async searchWithoutBudget(query: string): Promise<GeocodingResult[]> {
    const trimmed = query.trim()
    if (trimmed.length < 3) return []
    return this.request(trimmed)
  }

  private async request(trimmed: string): Promise<GeocodingResult[]> {
    const cacheKey = trimmed.toLowerCase()
    const cached = overpassPoiCache.get(cacheKey)
    if (cached) return cached

    const promise = this.fetchElements(trimmed)
    // Entra no cache JÁ como promessa, não só depois de resolver: é isso que
    // faz os dois consumidores compartilharem a mesma requisição em vez de
    // dispararem duas (a instância pública dá 2 slots por IP — duas
    // requisições iguais gastariam os dois).
    overpassPoiCache.set(cacheKey, promise)
    promise.catch(() => overpassPoiCache.delete(cacheKey))
    return promise
  }

  private async fetchElements(trimmed: string): Promise<GeocodingResult[]> {

    const { southWest, northEast } = SUPPORTED_REGION.bounds
    const bbox = `${southWest.lat},${southWest.lng},${northEast.lat},${northEast.lng}`
    const pattern = escapeOverpassRegex(trimmed)
    const clauses = OVERPASS_POI_TAG_KEYS.flatMap((key) => [
      `node["name"~"${pattern}",i]["${key}"](${bbox});`,
      `way["name"~"${pattern}",i]["${key}"](${bbox});`,
    ]).join('')
    const ql = `[out:json][timeout:${OVERPASS_POI_TIMEOUT_S}];(${clauses});out center 10;`

    // Só PERMANECE no cache o resultado de uma resposta BEM-SUCEDIDA (ver
    // `request`) — o servidor público do Overpass tem limite de taxa
    // compartilhado e pode responder 429/504 sob carga (confirmado em teste).
    // Manter a falha faria a busca ficar "presa" sem resultados de POI pelo
    // resto da sessão mesmo depois do limite liberar.
    // O `[timeout:N]` acima é uma instrução para o PRÓPRIO Overpass abortar o
    // processamento da consulta — não cobre lentidão de rede/fila antes
    // disso, então sem um limite do lado do cliente uma resposta que nunca
    // chega (confirmado em teste: servidor público sem responder) trava a
    // busca inteira indefinidamente, já que Promise.allSettled espera todas
    // as fontes. AbortController garante que essa fonte sempre desiste a
    // tempo, mesmo quando o servidor simplesmente não responde nada.
    const abortController = new AbortController()
    const abortTimer = setTimeout(() => abortController.abort(), OVERPASS_HARD_TIMEOUT_MS)
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
          const { label, secondaryLabel, poiCategory } = describeOverpassElement(element.tags as Record<string, string>)
          return { label, secondaryLabel, poiCategory, point }
        })
      return results
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

  async search(query: string, options: SearchOptions = {}): Promise<GeocodingResult[]> {
    const near = options.near ?? null
    const parsed = parseIntent(query)
    const categoryOnly = parsed != null && parsed.nameFilter === ''

    const candidates: RankCandidate[] = []
    const addAll = (results: GeocodingResult[], sourceBonus: number) => {
      for (const candidate of results) {
        const duplicate = candidates.find((existing) => isSamePlace(existing.result, candidate))
        if (duplicate) {
          mergeInto(duplicate.result, candidate, query, near)
          if (candidate.intentMatch) duplicate.intentMatch = true
        } else {
          candidates.push({ result: candidate, sourceBonus, intentMatch: candidate.intentMatch })
        }
      }
    }

    const ranked = () => rankCandidates([...candidates], { query, near: near ?? (categoryOnly ? SUPPORTED_REGION.center : null), categoryOnly })
    const emit = () => options.onPartial?.(ranked())
    let succeeded = 0
    const run = (promise: Promise<GeocodingResult[]>, sourceBonus: number) =>
      promise
        .then((results) => {
          succeeded += 1
          addAll(results, sourceBonus)
          emit()
        })
        .catch(() => undefined)

    // Fontes RÁPIDAS (~1 s): o que a lista espera.
    const rapidas = [
      // Região inteira: nomes específicos, onde quer que estejam.
      run(this.nominatim.search(query), 0),
      // Vizinhança de quem busca: termos genéricos e filiais próximas.
      near ? run(this.nominatim.searchNearby(query, near, parsed), 0) : Promise.resolve(),
      run(this.overpass.search(query), OVERPASS_OVER_NOMINATIM_BONUS),
      this.mapbox ? run(this.mapbox.search(query), MAPBOX_OVER_NOMINATIM_BONUS) : Promise.resolve(),
    ]

    // Fonte LENTA (10–30 s): a categoria no Overpass. Sem posição não há "perto",
    // então cai no centro da região — a lista ainda sai por distância, ao centro.
    const lenta = parsed
      ? run(this.overpass.searchIntent(parsed, near ?? SUPPORTED_REGION.center), 0)
      : Promise.resolve()

    await Promise.all(rapidas)
    // Espera a categoria só um pouco: se ela demorar, a lista sai sem ela e ela
    // entra DEPOIS, pelo mesmo `onPartial` — a busca não fica refém do mais lento.
    await Promise.race([lenta, new Promise((resolve) => setTimeout(resolve, INTENT_PATIENCE_MS))])

    if (succeeded === 0 && candidates.length === 0) {
      throw new Error('Não foi possível buscar estabelecimentos agora. Tente novamente.')
    }
    return ranked()
  }
}

/** Quanto a busca espera pela categoria (a fonte lenta) antes de entregar a lista sem ela. */
const INTENT_PATIENCE_MS = 3500

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

  async search(query: string, options: SearchOptions = {}): Promise<GeocodingResult[]> {
    const near = options.near ?? null
    const parsed = parseIntent(query)
    const categoryOnly = parsed != null && parsed.nameFilter === ''

    let addressResults: GeocodingResult[] = []
    let poiResults: GeocodingResult[] = []
    let addressOk = false
    let poiOk = false

    /**
     * Ordenação por TEXTO + DISTÂNCIA (ver search/ranking.ts).
     *
     * Um estabelecimento real (PoiProvider) ganha um bônus sobre um endereço
     * puro (GeocodingProvider) em caso de empate textual — sem isso, "Flor" bate
     * igualmente em "Rua Flor da Acácia" e em "Florênça" (a farmácia), e a rua
     * ocupava a vaga enquanto o estabelecimento nunca aparecia — bug real
     * encontrado em teste. O que mudou é que agora a distância também pesa, e
     * pesa MAIS quando o pedido é um tipo de lugar ("farmácia").
     */
    const combine = (): GeocodingResult[] => {
      const candidates: RankCandidate[] = addressResults.map((result) => ({
        result,
        sourceBonus: 0,
        intentMatch: result.intentMatch,
      }))
      for (const candidate of poiResults) {
        const duplicate = candidates.find((existing) => isSamePlace(existing.result, candidate))
        // O endereço sobrevive por estar primeiro, mas é o POI que sabe QUE
        // tipo de lugar é aquilo — e `mergeInto` deixa o melhor texto vencer.
        if (duplicate) {
          mergeInto(duplicate.result, candidate, query, near)
          if (candidate.intentMatch) duplicate.intentMatch = true
        } else candidates.push({ result: candidate, sourceBonus: POI_OVER_ADDRESS_BONUS, intentMatch: candidate.intentMatch })
      }
      const limite = categoryOnly ? MAX_COMBINED_RESULTS + 4 : MAX_COMBINED_RESULTS
      return rankCandidates(candidates, { query, near: near ?? (categoryOnly ? SUPPORTED_REGION.center : null), categoryOnly }).slice(0, limite)
    }
    const emit = () => options.onPartial?.(combine())

    const [addressOutcome, poiOutcome] = await Promise.allSettled([
      this.addressProvider.search(query, options).then((results) => {
        addressResults = results
        addressOk = true
        emit()
      }),
      this.poiProvider
        .search(query, {
          ...options,
          // A cada fonte do POI que responde, a lista inteira é recombinada.
          onPartial: (parcial) => {
            poiResults = parcial
            poiOk = true
            emit()
          },
        })
        .then((results) => {
          poiResults = results
          poiOk = true
        }),
    ])

    if (!addressOk && !poiOk && addressOutcome.status === 'rejected' && poiOutcome.status === 'rejected') {
      throw new Error('Não foi possível buscar o endereço agora. Tente novamente.')
    }
    return combine()
  }

  async reverseGeocode(point: LngLat): Promise<string | null> {
    return (await this.addressProvider.reverseGeocode(point)) ?? this.reverseGeocodeFallback.reverseGeocode(point)
  }
}

/**
 * SEGUNDA PASSADA das categorias, depois de a lista já estar na tela.
 *
 * POR QUE ELA EXISTE. O Overpass é a única fonte que conhece a tag real do
 * lugar (`amenity=bus_station`, `shop=bakery`) — o MapTiler devolve endereço e
 * o Nominatim devolve, para muitos lugares, a VIA de acesso em vez do
 * estabelecimento. Mas ele também é a fonte lenta e instável: medido, entre
 * 3,1s e 11,0s para a mesma consulta. Esperar por ele antes de mostrar a lista
 * é inaceitável; descartá-lo por atraso é perder a categoria.
 *
 * Então a lista sai com o que chegou a tempo e as categorias entram depois,
 * quando chegarem. Nenhum resultado é inventado nem removido aqui: a única
 * coisa que muda é o ícone de linhas que JÁ estão na tela, e só das que estão
 * sem categoria (`adoptCategory` é unilateral).
 *
 * Devolve `true` quando algo mudou — quem chama só re-renderiza nesse caso.
 */
export async function adoptLatePoiCategories(results: GeocodingResult[], query: string): Promise<boolean> {
  const pendentes = results.filter((result) => result.poiCategory == null)
  if (pendentes.length === 0) return false

  let pois: GeocodingResult[]
  try {
    pois = await new OverpassPoiProvider().searchWithoutBudget(query)
  } catch {
    return false
  }

  let mudou = false
  for (const poi of pois) {
    // Mesmo critério de "é o mesmo lugar" usado na mesclagem das fontes — a
    // regra de proximidade mora num lugar só.
    const alvo = pendentes.find(
      (result) => result.poiCategory == null && haversineDistanceMeters(result.point, poi.point) < DEDUPE_DISTANCE_METERS,
    )
    if (!alvo) continue
    adoptCategory(alvo, poi)
    mudou = mudou || alvo.poiCategory != null
  }
  return mudou
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
