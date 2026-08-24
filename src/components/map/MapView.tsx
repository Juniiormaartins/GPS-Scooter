import { useEffect, useRef } from 'react'
import maplibregl, { Map as MapLibreMap, Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { FALLBACK_DEMO_STYLE_URL, env, isMapConfigured } from '@/config/env'
import { SUPPORTED_REGION, type LngLat } from '@/config/region'
import { MAP_COLORS, MAP_COLORS_LIGHT } from '@/config/theme'
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
  /** Disparado ao tocar numa das linhas de rota candidatas — permite escolher a rota pelo mapa, não só pelo card. */
  onSelectRouteOption?: (routeId: string) => void
  /** Tema atual — o mapa tem uma paleta própria para cada um (ver config/theme.ts). */
  theme?: 'dark' | 'light'
  onMapReady?: (map: MapLibreMap) => void
}

const ROUTE_SOURCE_ID = 'gps-scooter-route'
const ROUTE_CASING_LAYER_ID = 'gps-scooter-route-casing'
const ROUTE_LAYER_ID = 'gps-scooter-route-line'
const ROUTE_OPTIONS_SOURCE_ID = 'gps-scooter-route-options'
const ROUTE_OPTIONS_LAYER_ID = 'gps-scooter-route-options-line'
const ROUTE_OPTIONS_DASHED_LAYER_ID = 'gps-scooter-route-options-line-dashed'

// Zoom "de rua" usado durante a navegação ativa — próximo o bastante para ler
// nomes de rua e a próxima manobra, mas sem escapar do enquadramento útil.
const NAVIGATION_ZOOM = 17.5
// Reserva espaço no TOPO do mapa (onde fica o cartão de instrução) — isso
// empurra o ponto centralizado (o usuário) para a parte inferior da tela,
// deixando a rota à frente visível acima dele, como num app de navegação real.
const NAVIGATION_PADDING = { top: 260, bottom: 40, left: 0, right: 0 }

/** Paleta de rota do tema atual — o mapa claro precisa de tons mais escuros para ter contraste. */
function routePalette(theme: 'dark' | 'light') {
  return theme === 'light' ? MAP_COLORS_LIGHT : MAP_COLORS
}

/**
 * Cor das candidatas: a SELECIONADA usa sempre o azul da marca (liga a rota
 * aos marcadores e ao resto da UI); as demais mantêm a cor semântica da
 * elegibilidade, que é onde a cor carrega informação de verdade.
 */
function routeOptionsColor(theme: 'dark' | 'light'): maplibregl.ExpressionSpecification {
  const palette = routePalette(theme)
  return [
    'case',
    ['get', 'active'],
    palette.routeSelected,
    [
      'match',
      ['get', 'eligibility'],
      'allowed',
      palette.routeByEligibility.allowed,
      'discouraged',
      palette.routeByEligibility.discouraged,
      palette.routeByEligibility['not-allowed'],
    ],
  ]
}

export function MapView({
  originPoint,
  destinationPoint,
  userPoint,
  routeGeometry,
  routeOptions = [],
  followUser = false,
  centerRequestId = 0,
  onUserInteraction,
  onSelectRouteOption,
  theme = 'dark',
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
  const onSelectRouteOptionRef = useRef(onSelectRouteOption)
  onSelectRouteOptionRef.current = onSelectRouteOption
  const themeRef = useRef(theme)
  themeRef.current = theme

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
      applyCartography(map, themeRef.current)

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
        paint: { 'line-color': routePalette(themeRef.current).routeCasing, 'line-width': 9, 'line-opacity': 0.9 },
      })
      map.addLayer({
        id: ROUTE_LAYER_ID,
        type: 'line',
        source: ROUTE_SOURCE_ID,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': routePalette(themeRef.current).routeSelected, 'line-width': 5, 'line-opacity': 0.95 },
      })

      // Múltiplas candidatas simultâneas (tela de seleção). Precisa de DUAS camadas
      // sobre a mesma fonte porque `line-dasharray` NÃO aceita expressão de dados no
      // MapLibre — tentar variar o tracejado por feature faz a camada inteira falhar
      // ao ser criada e NENHUMA rota é desenhada (bug real, confirmado no console).
      // Então o traço é decidido por filtro: adequada = linha sólida, com ressalva /
      // não recomendada = tracejada, como especifica a cartografia do handoff.
      map.addSource(ROUTE_OPTIONS_SOURCE_ID, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })

      const optionsPaint = (): maplibregl.LineLayerSpecification['paint'] => ({
        'line-color': routeOptionsColor(themeRef.current),
        // Largura e opacidade SÃO data-driven — a rota ativa fica mais grossa e opaca.
        'line-width': ['case', ['get', 'active'], 7, 4],
        'line-opacity': ['case', ['get', 'active'], 1, 0.5],
      })

      map.addLayer({
        id: ROUTE_OPTIONS_LAYER_ID,
        type: 'line',
        source: ROUTE_OPTIONS_SOURCE_ID,
        filter: ['==', ['get', 'eligibility'], 'allowed'],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: optionsPaint(),
      })
      map.addLayer({
        id: ROUTE_OPTIONS_DASHED_LAYER_ID,
        type: 'line',
        source: ROUTE_OPTIONS_SOURCE_ID,
        filter: ['!=', ['get', 'eligibility'], 'allowed'],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { ...optionsPaint(), 'line-dasharray': [2, 1.6] },
      })
      // Escolher a rota tocando na linha do mapa, além do card. `routeId` vem
      // das properties da feature, então mapa e lista ficam sincronizados: quem
      // recebe o id é o mesmo `onSelectRoute` usado pelos cards.
      for (const layerId of [ROUTE_OPTIONS_LAYER_ID, ROUTE_OPTIONS_DASHED_LAYER_ID]) {
        map.on('click', layerId, (event) => {
          const routeId = event.features?.[0]?.properties?.routeId
          if (typeof routeId === 'string') onSelectRouteOptionRef.current?.(routeId)
        })
        // Sinaliza que a linha é clicável (relevante no desktop; inofensivo no toque).
        map.on('mouseenter', layerId, () => {
          map.getCanvas().style.cursor = 'pointer'
        })
        map.on('mouseleave', layerId, () => {
          map.getCanvas().style.cursor = ''
        })
      }

      onMapReady?.(map)
    })

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Repinta o mapa quando o tema muda — sem isso, trocar de tema deixava a
  // interface clara sobre um mapa escuro (e vice-versa).
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    applyCartography(map, theme)

    // As camadas de rota do app também trocam de paleta: os tons do tema
    // escuro (ciano/verde vivos) perdem contraste sobre um mapa claro.
    const palette = routePalette(theme)
    const repaint = (layerId: string, color: unknown) => {
      if (map.getLayer(layerId)) map.setPaintProperty(layerId, 'line-color', color)
    }
    repaint(ROUTE_CASING_LAYER_ID, palette.routeCasing)
    repaint(ROUTE_LAYER_ID, palette.routeSelected)
    repaint(ROUTE_OPTIONS_LAYER_ID, routeOptionsColor(theme))
    repaint(ROUTE_OPTIONS_DASHED_LAYER_ID, routeOptionsColor(theme))
  }, [theme])

  // Alterna visibilidade entre a camada de rota única (navegação) e a de
  // múltiplas candidatas (seleção) — nunca as duas ao mesmo tempo.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getLayer(ROUTE_LAYER_ID)) return
    const showingOptions = routeOptions.length > 0
    const setVisibility = (layerId: string, visible: boolean) => {
      // Uma camada ausente (falha ao criar, estilo recarregado) não pode derrubar
      // o efeito e levar junto a visibilidade das outras.
      if (!map.getLayer(layerId)) return
      map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none')
    }
    setVisibility(ROUTE_LAYER_ID, !showingOptions)
    setVisibility(ROUTE_CASING_LAYER_ID, !showingOptions)
    setVisibility(ROUTE_OPTIONS_LAYER_ID, showingOptions)
    setVisibility(ROUTE_OPTIONS_DASHED_LAYER_ID, showingOptions)
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
      properties: { routeId: option.id, eligibility: option.eligibility, active: option.isActive },
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

    // Destino escolhido mas rota ainda NÃO calculada: enquadra origem e
    // destino juntos para o usuário entender onde fica o lugar antes de
    // decidir traçar a rota. Quando a rota chega, o enquadramento dela
    // (mais preciso, segue a geometria) assume — por isso a condição.
    if (!destinationPoint || routeGeometry || routeOptions.length > 0) return

    const anchor = userPoint ?? originPoint
    if (!anchor) {
      map.flyTo({ center: [destinationPoint.lng, destinationPoint.lat], zoom: 15, duration: 700 })
      return
    }

    const bounds = new maplibregl.LngLatBounds(
      [anchor.lng, anchor.lat],
      [anchor.lng, anchor.lat],
    ).extend([destinationPoint.lng, destinationPoint.lat])
    // `bottom` maior por causa da ficha do local, que ocupa a base da tela.
    map.fitBounds(bounds, { padding: { top: 180, bottom: 300, left: 56, right: 56 }, duration: 700, maxZoom: 16 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

/**
 * Aplica a cartografia escura do handoff de design ao estilo REAL do provedor
 * (MapTiler), recolorindo as camadas já carregadas — não substitui o mapa por
 * um desenho. Ver design/gps-scooter-ui/README.md → "Cartografia".
 *
 * O casamento é por heurística no id/tipo da camada porque o MapTiler não
 * expõe papéis semânticos; por isso cada `setPaintProperty` é protegido por
 * try/catch: uma camada com propriedade inesperada é ignorada em vez de
 * derrubar o mapa inteiro. Se o provedor mudar os ids, o mapa continua
 * funcionando — só volta às cores originais dele.
 *
 * Por que recolorir em vez de usar um estilo "dark" pronto: os prontos que
 * testamos (Mapbox dark-v11) têm contraste fundo/via de ~1,5x, ilegível para
 * um GPS. A paleta do handoff tem ~3x, medido.
 */
function applyCartography(map: MapLibreMap, theme: 'dark' | 'light') {
  const C = theme === 'light' ? MAP_COLORS_LIGHT : MAP_COLORS
  const setPaint = (layerId: string, property: string, value: string) => {
    try {
      map.setPaintProperty(layerId, property, value)
    } catch {
      // Camada não aceita essa propriedade — ignorar e seguir com as demais.
    }
  }

  for (const layer of map.getStyle().layers ?? []) {
    // NUNCA recolorir as camadas do próprio app. Elas são `type: 'line'` e
    // sem isso a heurística de vias as tratava como "via secundária" — no tema
    // claro isso pintava a rota de #F7F9FD (quase branco) sobre um mapa claro,
    // fazendo o traçado sumir por completo ao trocar de tema. Bug real.
    if (layer.id.startsWith('gps-scooter-')) continue

    const id = layer.id.toLowerCase()

    if (layer.type === 'background') {
      setPaint(layer.id, 'background-color', C.background)
      continue
    }

    if (layer.type === 'fill') {
      if (id.includes('water') || id.includes('ocean')) setPaint(layer.id, 'fill-color', C.water)
      else if (id.includes('building')) setPaint(layer.id, 'fill-color', C.roadMinor)
      else if (id.includes('park') || id.includes('green') || id.includes('wood') || id.includes('landcover')) {
        setPaint(layer.id, 'fill-color', theme === 'light' ? '#E3EDE3' : '#101B2C')
      } else setPaint(layer.id, 'fill-color', C.background)
      continue
    }

    if (layer.type === 'line') {
      // Os ids reais do MapTiler são "Highway", "Major road", "Minor road",
      // "Bridge", "Path"… (não "motorway/primary" como em outros provedores) —
      // conferido contra o style.json em uso. Errar isso pinta TODA via com a
      // cor de via secundária, que é quase o fundo, e o mapa some.
      if (id.endsWith('outline')) {
        // Contorno fica no tom do fundo: separa as vias sem competir com elas.
        setPaint(layer.id, 'line-color', C.background)
      } else if (id.includes('highway') || id.includes('major road') || id.includes('bridge')) {
        setPaint(layer.id, 'line-color', C.roadMajor)
      } else {
        setPaint(layer.id, 'line-color', C.roadMinor)
      }
      continue
    }

    if (layer.type === 'symbol') {
      // Rótulos sem halo branco (regra explícita do handoff).
      setPaint(layer.id, 'text-color', C.label)
      setPaint(layer.id, 'text-halo-color', C.background)
      continue
    }

    if (layer.type === 'circle') {
      setPaint(layer.id, 'circle-color', C.poi)
    }
  }
}

/**
 * Marcadores sobre o mapa escuro. O do usuário segue a spec do handoff
 * ("LocationPuck"): disco azul 22px com halo translúcido de 48px — bem maior
 * que origem/destino, porque é o elemento vivo da tela.
 */
function markerClassName(kind: 'origin' | 'destination' | 'user'): string {
  if (kind === 'user') {
    return 'h-[22px] w-[22px] rounded-pill bg-brand-500 ring-[13px] ring-brand-500/[.22] shadow-route'
  }
  const base = 'h-3.5 w-3.5 rounded-pill border-2 border-surface-map'
  if (kind === 'origin') return `${base} bg-brand-500`
  return `${base} bg-success-500`
}
