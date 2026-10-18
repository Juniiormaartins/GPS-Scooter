import type { LngLat } from '@/config/region'

/**
 * Destino que chegou de FORA do app — hoje, só pela casca Android.
 *
 * Como chega: quando outro app manda o GPS Scooter abrir um endereço (um
 * `geo:` / `google.navigation:` ou o "Compartilhar" de texto), a casca Android
 * (android-shell/) converte isso numa navegação do WebView para
 * `/?entrada=<texto cru>`. Aqui só se lê esse parâmetro. É de propósito que não
 * há ponte JavaScript↔nativo: um parâmetro de URL é algo que se testa num
 * navegador comum e que sobrevive a recarregar a página.
 */
export type IncomingDestination =
  | { kind: 'place'; label: string; point: LngLat }
  | { kind: 'search'; text: string }

export const INCOMING_PARAM = 'entrada'

/** Rótulo quando o destino chega só como coordenada, sem nome. */
const UNNAMED_PLACE_LABEL = 'Destino compartilhado'

/** Duas coordenadas COM casas decimais — "Rua 5, 123" não pode virar um ponto no mapa. */
const DECIMAL_COORDS = /(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/

function toPoint(lat: number, lng: number): LngLat | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  // 0,0 é o "sem posição" do `geo:0,0?q=Endereço` — nunca um destino de verdade.
  if (lat === 0 && lng === 0) return null
  return { lat, lng }
}

/** "lat,lng" ou "lat,lng(Rótulo)", como o `q=` de um geo: costuma vir. */
function parseCoordsWithLabel(value: string): { point: LngLat; label: string | null } | null {
  const match = value.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*(?:\((.*)\))?\s*$/)
  if (!match) return null
  const point = toPoint(Number(match[1]), Number(match[2]))
  if (!point) return null
  const label = match[3]?.trim()
  return { point, label: label ? label : null }
}

/**
 * "Endereço completo@lat,lng" — como o iFood manda o destino: o texto do endereço
 * seguido de `@` e a coordenada exata. A coordenada vale mais que o texto (que o
 * geocodificador não acha, por causa de "Casa Qd 14 Lt 22"), e o texto vira o nome.
 */
export function splitAddressAtCoords(value: string): { label: string; point: LngLat } | null {
  const match = value.match(/^([\s\S]*?)\s*@\s*(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/)
  if (!match) return null
  const point = toPoint(Number(match[2]), Number(match[3]))
  if (!point) return null
  return { label: match[1].trim() || UNNAMED_PLACE_LABEL, point }
}

function placeOrSearch(value: string, fallbackPoint: LngLat | null): IncomingDestination | null {
  const text = value.trim()
  const atCoords = splitAddressAtCoords(text)
  if (atCoords) return { kind: 'place', ...atCoords }
  if (!text) return fallbackPoint ? { kind: 'place', label: UNNAMED_PLACE_LABEL, point: fallbackPoint } : null

  const withCoords = parseCoordsWithLabel(text)
  if (withCoords) {
    return { kind: 'place', label: withCoords.label ?? UNNAMED_PLACE_LABEL, point: withCoords.point }
  }
  // Texto com ponto conhecido (geo:-16.6,-49.2?q=Padaria): o ponto vale e o texto é o nome.
  if (fallbackPoint) return { kind: 'place', label: text, point: fallbackPoint }
  return { kind: 'search', text }
}

/**
 * `geo:lat,lng?q=...` (RFC 5870 + a convenção do Android).
 *   geo:-16.68,-49.25                       → ponto, sem nome
 *   geo:-16.68,-49.25?q=Padaria             → ponto com nome
 *   geo:0,0?q=Rua das Flores, 100           → BUSCA por endereço
 *   geo:0,0?q=-16.68,-49.25(Casa)           → ponto com nome
 */
function parseGeoUri(raw: string): IncomingDestination | null {
  const body = raw.slice('geo:'.length)
  const [pathPart, queryPart = ''] = body.split('?')
  const coords = pathPart.split(';')[0]
  const [latText, lngText] = coords.split(',')
  const pathPoint = toPoint(Number(latText), Number(lngText))
  const q = new URLSearchParams(queryPart).get('q') ?? ''
  // Endereço direto no corpo (`geo:Rua X, 10@-16.6,-49.2`), sem coordenada nem `q=`.
  if (!q && !pathPoint) {
    let decoded = body
    try {
      decoded = decodeURIComponent(body)
    } catch {
      // mantém o texto como veio
    }
    return placeOrSearch(decoded, null)
  }
  return placeOrSearch(q, pathPoint)
}

/** `google.navigation:q=lat,lng` ou `q=Endereço` (e, menos comum, `ll=lat,lng`). */
function parseGoogleNavigation(raw: string): IncomingDestination | null {
  const params = new URLSearchParams(raw.slice('google.navigation:'.length))
  const ll = params.get('ll')
  const llPoint = ll ? parseCoordsWithLabel(ll)?.point ?? null : null
  return placeOrSearch(params.get('q') ?? '', llPoint)
}

/**
 * Texto vindo de "Compartilhar". Quase sempre é um endereço ("Rua X, 123 - Setor
 * Y, Goiânia"); às vezes é um link do Maps com coordenadas. Links curtos
 * (maps.app.goo.gl) não dão para abrir daqui e são ignorados.
 */
function parseSharedText(raw: string): IncomingDestination | null {
  const atCoords = splitAddressAtCoords(raw.trim())
  if (atCoords) return { kind: 'place', ...atCoords }
  const coords = raw.match(DECIMAL_COORDS)
  const point = coords ? toPoint(Number(coords[1]), Number(coords[2])) : null
  const withoutLinks = raw.replace(/https?:\/\/\S+/gi, ' ')
  const text = withoutLinks
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(', ')
    .slice(0, 200)
  if (point) return { kind: 'place', label: text || UNNAMED_PLACE_LABEL, point }
  return text ? { kind: 'search', text } : null
}

export function parseIncomingDestination(raw: string): IncomingDestination | null {
  const value = raw.trim()
  if (!value) return null
  const lower = value.toLowerCase()
  if (lower.startsWith('geo:')) return parseGeoUri(value)
  if (lower.startsWith('google.navigation:')) return parseGoogleNavigation(value)
  return parseSharedText(value)
}

/**
 * Lê o destino recebido na URL de abertura e o REMOVE da barra de endereço, para
 * que recarregar a página não repita o destino. Chamar uma vez, ao montar o app.
 */
export function consumeIncomingDestination(): IncomingDestination | null {
  let raw: string | null = null
  try {
    const url = new URL(window.location.href)
    raw = url.searchParams.get(INCOMING_PARAM)
    if (raw === null) return null
    url.searchParams.delete(INCOMING_PARAM)
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)
  } catch {
    return null
  }
  return parseIncomingDestination(raw)
}

/**
 * Texto digitado/colado na busca que já traz a coordenada: "Endereço@lat,lng" ou
 * só "lat, lng". Devolve o ponto direto, sem passar pelo geocodificador.
 */
export function parseCoordinateQuery(query: string): { label: string; point: LngLat } | null {
  const text = query.trim()
  const atCoords = splitAddressAtCoords(text)
  if (atCoords) return atCoords
  const plain = text.match(/^(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/)
  if (!plain) return null
  const point = toPoint(Number(plain[1]), Number(plain[2]))
  return point ? { label: UNNAMED_PLACE_LABEL, point } : null
}
