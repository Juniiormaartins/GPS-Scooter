/**
 * Leitura centralizada de variáveis de ambiente.
 * A aplicação deve continuar iniciando mesmo sem essas variáveis configuradas —
 * componentes que dependem delas devem checar `isConfigured` e exibir um aviso,
 * nunca lançar exceção durante o carregamento.
 *
 * Geocodificação e roteamento usam, por padrão, serviços públicos e gratuitos
 * (Nominatim/OSM e OSRM demo) que não exigem chave — adequado para este
 * protótipo. Ambos têm limites de uso e não são recomendados para produção;
 * defina VITE_GEOCODING_BASE_URL/VITE_ROUTING_BASE_URL para trocar por um
 * provedor pago (Mapbox, OpenRouteService, etc.) quando for o caso.
 */

const NOMINATIM_DEFAULT_BASE_URL = 'https://nominatim.openstreetmap.org'
const OSRM_DEMO_DEFAULT_BASE_URL = 'https://router.project-osrm.org'
const MAPTILER_STYLE_ID = 'streets-v2'

/**
 * Resolve a URL do estilo do mapa. Prioridade:
 * 1. VITE_MAP_STYLE_URL — override explícito, aceita qualquer provedor compatível com MapLibre.
 * 2. VITE_MAPTILER_API_KEY — monta a URL do estilo do MapTiler (provedor padrão do GPS Scooter).
 * 3. Nenhuma das duas — MapView usa o fallback de demonstração (ver FALLBACK_DEMO_STYLE_URL).
 */
function resolveMapStyleUrl(): string {
  const explicitStyleUrl = import.meta.env.VITE_MAP_STYLE_URL ?? ''
  if (explicitStyleUrl) return explicitStyleUrl

  const maptilerApiKey = import.meta.env.VITE_MAPTILER_API_KEY ?? ''
  if (maptilerApiKey) {
    return `https://api.maptiler.com/maps/${MAPTILER_STYLE_ID}/style.json?key=${maptilerApiKey}`
  }

  return ''
}

export const env = {
  mapStyleUrl: resolveMapStyleUrl(),
  maptilerApiKey: import.meta.env.VITE_MAPTILER_API_KEY ?? '',
  geocodingApiKey: import.meta.env.VITE_GEOCODING_API_KEY ?? '',
  /** Só truthy quando VITE_GEOCODING_BASE_URL foi definida explicitamente — distinto do fallback abaixo (ver services/geocoding.ts). */
  geocodingBaseUrlOverride: import.meta.env.VITE_GEOCODING_BASE_URL ?? '',
  geocodingBaseUrl: import.meta.env.VITE_GEOCODING_BASE_URL || NOMINATIM_DEFAULT_BASE_URL,
  routingApiKey: import.meta.env.VITE_ROUTING_API_KEY ?? '',
  routingBaseUrl: import.meta.env.VITE_ROUTING_BASE_URL || OSRM_DEMO_DEFAULT_BASE_URL,
  /** Opcional — provedor complementar de POI (ver services/geocoding.ts, MapboxPoiProvider). Sem essa chave, a busca continua funcionando só com Nominatim+Overpass. */
  mapboxApiKey: import.meta.env.VITE_MAPBOX_API_KEY ?? '',
}

export const isMapConfigured = env.mapStyleUrl.length > 0
export const isGeocodingConfigured = env.geocodingBaseUrl.length > 0
export const isRoutingConfigured = env.routingBaseUrl.length > 0

/** Estilo público de demonstração usado apenas quando nenhuma chave foi configurada. */
export const FALLBACK_DEMO_STYLE_URL = 'https://demotiles.maplibre.org/style.json'
