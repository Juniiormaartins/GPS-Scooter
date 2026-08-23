import { useEffect, useRef } from 'react'
import maplibregl, { Map as MapLibreMap, Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { FALLBACK_DEMO_STYLE_URL, env, isMapConfigured } from '@/config/env'
import { SUPPORTED_REGION, type LngLat } from '@/config/region'
import { MAP_COLORS } from '@/config/theme'
import type { Eligibility } from '@/types/routing'

export interface RouteOptionGeometry {
  id: string
  geometry: LngLat[]
  eligibility: Eligibility
  isActive: boolean
}

interface MapViewProps {
  originPoint: LngLat | null
  destinationPoint: LngLat | null
  userPoint: LngLat | null
  /** Rota única (navegação ativa — uma rota já confirmada, linha na cor da marca). */
  routeGeometry: LngLat[] | null
  /** Várias candidatas simultâneas (tela de seleção de rota) — cada uma colorida pela própria elegibilidade. Ignorado se vazio/ausente; nesse caso usa `routeGeometry`. */
  routeOptions?: RouteOptionGeometry[]
  /** Quando true, a câmera acompanha `userPoint` continuamente (uso: navegação ativa). */
  followUser?: boolean
  /**
   * Incremente este valor para fazer a câmera voar até `userPoint` UMA vez
   * (uso: botão "minha localização" fora da navegação — centraliza sem
   * ligar o acompanhamento contínuo). Ignorado se `userPoint` for null.
   */
  centerRequestId?: number
  /** Disparado quando o usuário arrasta/pinça o mapa manualmente — usado para interromper o modo "seguir". */
  onUserInteraction?: () => void
  onMapReady?: (map: MapLibreMap) => void
}

const ROUTE_SOURCE_ID = 'gps-scooter-route'
const ROUTE_CASING_LAYER_ID = 'gps-scooter-route-casing'
const ROUTE_LAYER_ID = 'gps-scooter-route-line'
const ROUTE_OPTIONS_SOURCE_ID = 'gps-scooter-route-options'
const ROUTE_OPTIONS_LAYER_ID = 'gps-scooter-route-options-line'

// Zoom "de rua" usado durante a navegação ativa — próximo o bastante para ler
// nomes de rua e a próxima manobra, mas sem escapar do enquadramento útil.
const NAVIGATION_ZOOM = 17.5
// Reserva espaço no TOPO do mapa (onde fica o cartão de instrução) — isso
// empurra o ponto centralizado (o usuário) para a parte inferior da tela,
// deixando a rota à frente visível acima dele, como num app de navegação real.
const NAVIGATION_PADDING = { top: 260, bottom: 40, left: 0, right: 0 }

export function MapView({
  originPoint,
  destinationPoint,
  userPoint,
  routeGeometry,
  routeOptions = [],
  followUser = false,
  centerRequestId = 0,
  onUserInteraction,
  onMapReady,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const originMarkerRef = useRef<Marker | null>(null)
  const destinationMarkerRef = useRef<Marker | null>(null)
  const userMarkerRef = useRef<Marker | null>(null)
  const routeGeometryRef = useRef(routeGeometry)
  routeGeometryRef.current = routeGeometry
  const onUserInteractionRef = useRef(onUserInteraction)
  onUserInteractionRef.current = onUserInteraction

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: isMapConfigured ? env.mapStyleUrl : FALLBACK_DEMO_STYLE_URL,
      center: [SUPPORTED_REGION.center.lng, SUPPORTED_REGION.center.lat],
      zoom: SUPPORTED_REGION.initialZoom,
      attributionControl: { compact: true },
    })

    // `originalEvent` só existe em eventos disparados por gesto real do usuário
    // (arrastar/pinçar) — chamadas programáticas (easeTo/fitBounds) não o têm,
    // então isso não interrompe o modo "seguir" quando é o próprio app movendo a câmera.
    const notifyUserInteraction = (e: { originalEvent?: unknown }) => {
      if (e.originalEvent) onUserInteractionRef.current?.()
    }
    map.on('dragstart', notifyUserInteraction)
    map.on('zoomstart', notifyUserInteraction)

    map.on('load', () => {
      map.addSource(ROUTE_SOURCE_ID, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            // Usa o valor mais recente conhecido no momento em que o estilo termina de
            // carregar — evita perder a rota quando ela já existia antes do 'load'.
            coordinates: (routeGeometryRef.current ?? []).map((point) => [point.lng, point.lat]),
          },
        },
      })
      // Camada de contorno (casing) clara sob a linha principal: garante que a
      // rota permaneça legível mesmo sobre áreas do mapa predominantemente azuis.
      map.addLayer({
        id: ROUTE_CASING_LAYER_ID,
        type: 'line',
        source: ROUTE_SOURCE_ID,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': MAP_COLORS.routeCasing, 'line-width': 9, 'line-opacity': 0.9 },
      })
      map.addLayer({
        id: ROUTE_LAYER_ID,
        type: 'line',
        source: ROUTE_SOURCE_ID,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': MAP_COLORS.routeLine, 'line-width': 5, 'line-opacity': 0.95 },
      })

      // Múltiplas candidatas simultâneas (tela de seleção) — uma FeatureCollection com uma
      // linha por rota, cor por `eligibility` e destaque (largura/opacidade) por `active`.
      map.addSource(ROUTE_OPTIONS_SOURCE_ID, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({
        id: ROUTE_OPTIONS_LAYER_ID,
        type: 'line',
        source: ROUTE_OPTIONS_SOURCE_ID,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': [
            'match',
            ['get', 'eligibility'],
            'allowed',
            MAP_COLORS.routeByEligibility.allowed,
            'discouraged',
            MAP_COLORS.routeByEligibility.discouraged,
            MAP_COLORS.routeByEligibility['not-allowed'],
          ],
          'line-width': ['case', ['get', 'active'], 5, 3],
          'line-opacity': ['case', ['get', 'active'], 1, 0.65],
          'line-dasharray': ['case', ['get', 'active'], ['literal', [1, 0]], ['literal', [2, 1.6]]],
        },
      })
      onMapReady?.(map)
    })

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Alterna visibilidade entre a camada de rota única (navegação) e a de
  // múltiplas candidatas (seleção) — nunca as duas ao mesmo tempo.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getLayer(ROUTE_LAYER_ID)) return
    const showingOptions = routeOptions.length > 0
    const single = showingOptions ? 'none' : 'visible'
    map.setLayoutProperty(ROUTE_LAYER_ID, 'visibility', single)
    map.setLayoutProperty(ROUTE_CASING_LAYER_ID, 'visibility', single)
    map.setLayoutProperty(ROUTE_OPTIONS_LAYER_ID, 'visibility', showingOptions ? 'visible' : 'none')
  }, [routeOptions.length])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const source = map.getSource(ROUTE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined
    if (!source || routeOptions.length > 0) return

    const coordinates: [number, number][] = (routeGeometry ?? []).map((point) => [point.lng, point.lat])

    source.setData({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates },
    })

    // Centraliza e enquadra a câmera na rota recém-calculada, com respiro para
    // não ficar escondida atrás do SearchPanel (topo) e do RoutePanel (base).
    if (coordinates.length >= 2) {
      const bounds = coordinates.reduce(
        (acc, coord) => acc.extend(coord),
        new maplibregl.LngLatBounds(coordinates[0], coordinates[0]),
      )
      map.fitBounds(bounds, {
        padding: { top: 220, bottom: 220, left: 48, right: 48 },
        duration: 600,
      })
    }
  }, [routeGeometry, routeOptions.length])

  // Múltiplas candidatas simultâneas — uma linha colorida por elegibilidade
  // para cada rota, enquadrando a câmera em todas de uma vez (não só a ativa).
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const source = map.getSource(ROUTE_OPTIONS_SOURCE_ID) as maplibregl.GeoJSONSource | undefined
    if (!source || routeOptions.length === 0) return

    const features: GeoJSON.Feature<GeoJSON.LineString>[] = routeOptions.map((option) => ({
      type: 'Feature',
      properties: { eligibility: option.eligibility, active: option.isActive },
      geometry: { type: 'LineString', coordinates: option.geometry.map((point) => [point.lng, point.lat]) },
    }))
    source.setData({ type: 'FeatureCollection', features })

    const allCoordinates = features.flatMap((feature) => feature.geometry.coordinates as [number, number][])
    if (allCoordinates.length >= 2) {
      const bounds = allCoordinates.reduce(
        (acc, coord) => acc.extend(coord),
        new maplibregl.LngLatBounds(allCoordinates[0], allCoordinates[0]),
      )
      map.fitBounds(bounds, { padding: { top: 220, bottom: 260, left: 48, right: 48 }, duration: 600 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeOptions])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    updateMarker(originMarkerRef, map, originPoint, 'origin')
  }, [originPoint])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    updateMarker(destinationMarkerRef, map, destinationPoint, 'destination')
  }, [destinationPoint])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    updateMarker(userMarkerRef, map, userPoint, 'user')

    if (followUser && userPoint) {
      map.easeTo({
        center: [userPoint.lng, userPoint.lat],
        zoom: NAVIGATION_ZOOM,
        padding: NAVIGATION_PADDING,
        duration: 500,
      })
    }
  }, [userPoint, followUser])

  // Centralização de disparo único (botão "minha localização" fora da
  // navegação) — dispara ao mudar `centerRequestId`, não a cada atualização
  // de `userPoint`, para não competir com o usuário arrastando o mapa livremente.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !userPoint || centerRequestId === 0) return
    map.flyTo({ center: [userPoint.lng, userPoint.lat], zoom: Math.max(map.getZoom(), 15), duration: 800 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerRequestId])

  return <div ref={containerRef} className="absolute inset-0" />
}

function updateMarker(
  ref: React.MutableRefObject<Marker | null>,
  map: MapLibreMap,
  point: LngLat | null,
  kind: 'origin' | 'destination' | 'user',
) {
  if (!point) {
    ref.current?.remove()
    ref.current = null
    return
  }

  if (!ref.current) {
    const el = document.createElement('div')
    el.className = markerClassName(kind)
    ref.current = new maplibregl.Marker({ element: el })
  }

  ref.current.setLngLat([point.lng, point.lat]).addTo(map)
}

function markerClassName(kind: 'origin' | 'destination' | 'user'): string {
  const base = 'h-4 w-4 rounded-full border-2 border-white shadow-md'
  if (kind === 'origin') return `${base} bg-brand-600`
  if (kind === 'destination') return `${base} bg-success-600`
  return `${base} bg-brand-500 ring-4 ring-brand-500/30`
}
