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

/**
 * Trecho específico da rota classificado como inadequado. Existe para que uma
 * rota "recomendada" que contenha 200 m inevitáveis de via ruim mostre ONDE
 * está esse pedaço, em vez de esconder a diferença sob uma cor única.
 */
export interface RouteWarningSegment {
  path: LngLat[]
  /** 'caution' = atenção (âmbar); 'unsuitable'/'prohibited' = inadequado (vermelho). */
  severity: 'caution' | 'unsuitable'
}

interface MapViewProps {
  originPoint: LngLat | null
  destinationPoint: LngLat | null
  userPoint: LngLat | null
  /** Rota única (navegação ativa — uma rota já confirmada, linha na cor da marca). */
  routeGeometry: LngLat[] | null
  /** Várias candidatas simultâneas (tela de seleção de rota) — cada uma colorida pela própria elegibilidade. Ignorado se vazio/ausente; nesse caso usa `routeGeometry`. */
  routeOptions?: RouteOptionGeometry[]
  /** Trechos problemáticos da rota ATIVA, destacados por cima do traçado principal. */
  routeWarnings?: RouteWarningSegment[]
  /** Quando true, a câmera acompanha `userPoint` continuamente (uso: navegação ativa). */
  followUser?: boolean
  /**
   * Direção de deslocamento em graus. Quando presente e `followUser` está
   * ligado, o mapa gira para que o caminho à frente aponte sempre para cima —
   * é o que torna "vire à esquerda" coerente com o que se vê na tela.
   * Ausente = mapa mantém o norte para cima (sem girar às cegas).
   */
  headingDeg?: number | null
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
  /**
   * `true` enquanto o que está desenhado é o PREVIEW (rota única, calculada
   * assim que o destino foi escolhido) e não a rota já confirmada. Deixa o
   * traçado um pouco mais fino e translúcido — o suficiente para não ser
   * confundido com o estado definitivo, sem virar outra linguagem visual.
   */
  isRoutePreview?: boolean
  /**
   * Navegação ativa. Diferente de `followUser`: continua true mesmo quando o
   * usuário arrasta o mapa e o acompanhamento é suspenso — é essa distinção
   * que impede o mapa de girar para o norte no meio do percurso.
   */
  isNavigating?: boolean
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
/**
 * Camada INVISÍVEL e larga sobre as mesmas linhas, só para capturar toque.
 * As linhas visíveis têm 4–7px: acertá-las com o dedo é impraticável (o alvo
 * mínimo confortável é ~44px). Esta camada tem opacidade 0 e 30px de largura,
 * então o usuário toca "perto da rota" e a seleção funciona — no toque e no
 * mouse, em qualquer tema.
 */
const ROUTE_OPTIONS_HIT_LAYER_ID = 'gps-scooter-route-options-hit'
/** Trechos inadequados DENTRO da rota selecionada — desenhados por cima dela. */
const ROUTE_WARN_SOURCE_ID = 'gps-scooter-route-warn'
const ROUTE_WARN_LAYER_ID = 'gps-scooter-route-warn-line'

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
  routeWarnings = [],
  isRoutePreview = false,
  isNavigating = false,
  followUser = false,
  headingDeg = null,
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
      map.addSource(ROUTE_WARN_SOURCE_ID, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({
        id: ROUTE_WARN_LAYER_ID,
        type: 'line',
        source: ROUTE_WARN_SOURCE_ID,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': [
            'match',
            ['get', 'severity'],
            'caution',
            routePalette(themeRef.current).routeByEligibility.discouraged,
            routePalette(themeRef.current).routeByEligibility['not-allowed'],
          ],
          // Mais estreita que a rota (que tem 7px quando ativa): fica DENTRO
          // dela, como um trecho marcado, sem virar uma faixa de alerta.
          'line-width': 4,
          'line-opacity': 0.95,
        },
      })

      map.addLayer({
        id: ROUTE_OPTIONS_HIT_LAYER_ID,
        type: 'line',
        source: ROUTE_OPTIONS_SOURCE_ID,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#000000', 'line-opacity': 0, 'line-width': 30 },
      })

      // Escolher a rota tocando na linha do mapa, além do card. `routeId` vem
      // das properties da feature, então mapa e lista ficam sincronizados: quem
      // recebe o id é o mesmo `onSelectRoute` usado pelos cards.
      for (const layerId of [ROUTE_OPTIONS_HIT_LAYER_ID]) {
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

  // Trechos problemáticos da rota ativa. Redesenhados sempre que a rota ou o
  // tema mudam — a cor vem da mesma paleta semântica das candidatas.
  useEffect(() => {
    const map = mapRef.current
    const source = map?.getSource(ROUTE_WARN_SOURCE_ID) as maplibregl.GeoJSONSource | undefined
    if (!map || !source) return

    source.setData({
      type: 'FeatureCollection',
      features: routeWarnings
        .filter((segment) => segment.path.length >= 2)
        .map((segment) => ({
          type: 'Feature' as const,
          properties: { severity: segment.severity },
          geometry: {
            type: 'LineString' as const,
            coordinates: segment.path.map((point) => [point.lng, point.lat]),
          },
        })),
    })

    if (map.getLayer(ROUTE_WARN_LAYER_ID)) {
      map.setPaintProperty(ROUTE_WARN_LAYER_ID, 'line-color', [
        'match',
        ['get', 'severity'],
        'caution',
        routePalette(theme).routeByEligibility.discouraged,
        routePalette(theme).routeByEligibility['not-allowed'],
      ])
    }
  }, [routeWarnings, theme])

  // Ao SAIR DA NAVEGAÇÃO, desfaz a rotação: fora dela, norte para cima é o
  // que o usuário espera para se orientar.
  //
  // A condição era `!followUser`, e isso estava errado: `followUser` também
  // fica false quando a pessoa apenas arrasta o mapa DURANTE o percurso —
  // então olhar o trajeto à frente girava o mapa para o norte e obrigava a
  // recentralizar só para recuperar a orientação. Agora depende de a
  // navegação ter terminado de fato.
  useEffect(() => {
    const map = mapRef.current
    if (!map || isNavigating) return
    if (map.getBearing() !== 0) map.easeTo({ bearing: 0, duration: 400 })
  }, [isNavigating])

  // Repinta o mapa quando o tema muda — sem isso, trocar de tema deixava a
  // interface clara sobre um mapa escuro (e vice-versa).
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const applyTheme = () => {
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
    }

    // Antes isto era `if (!map.isStyleLoaded()) return` — e aí acabava.
    //
    // `isStyleLoaded()` fica false enquanto o MapLibre processa mudanças de
    // estilo ou carrega tiles, o que é MUITO comum logo depois de mexer numa
    // fonte (escolher destino, traçar rota). Trocar de tema nessa janela fazia
    // a repintura ser descartada em silêncio e nunca mais acontecer: a
    // interface ficava clara sobre um mapa escuro até recarregar a página.
    // Reproduzido com o app rodando. Agora, se o estilo não estiver pronto,
    // espera o próximo 'idle' e aplica.
    if (map.isStyleLoaded()) {
      applyTheme()
      return
    }

    map.once('idle', applyTheme)
    return () => {
      map.off('idle', applyTheme)
    }
  }, [theme])

  // Preview vs. rota confirmada: mesma cor e mesma geometria real, só com
  // peso menor. A distinção forte entre os dois estados é estrutural — no
  // preview existe UMA linha, depois de "Traçar rota" existem as alternativas
  // coloridas por elegibilidade e uma delas destacada como ativa.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getLayer(ROUTE_LAYER_ID)) return
    map.setPaintProperty(ROUTE_LAYER_ID, 'line-width', isRoutePreview ? 4 : 5)
    map.setPaintProperty(ROUTE_LAYER_ID, 'line-opacity', isRoutePreview ? 0.75 : 0.95)
    if (map.getLayer(ROUTE_CASING_LAYER_ID)) {
      map.setPaintProperty(ROUTE_CASING_LAYER_ID, 'line-width', isRoutePreview ? 7.5 : 9)
    }
  }, [isRoutePreview])

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
    setVisibility(ROUTE_OPTIONS_HIT_LAYER_ID, showingOptions)
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
    // Depende de estar NAVEGANDO com direção conhecida — não de `followUser`.
    // Arrastar o mapa para olhar o trajeto à frente suspende o
    // acompanhamento, mas não apaga a direção em que a pessoa está indo;
    // trocar a scooter pelo disco nesse momento seria descartar informação
    // que temos. O disco fica para quando a direção é mesmo desconhecida.
    updateUserMarker(userMarkerRef, map, userPoint, headingDeg, isNavigating && headingDeg != null)

    if (followUser && userPoint) {
      map.easeTo({
        center: [userPoint.lng, userPoint.lat],
        zoom: NAVIGATION_ZOOM,
        padding: NAVIGATION_PADDING,
        // Gira o mapa na direção do deslocamento. Sem heading conhecido,
        // mantém o ângulo atual em vez de forçar o norte — evita que o mapa
        // "pule" de volta toda vez que o GPS perde a direção momentaneamente.
        bearing: headingDeg ?? map.getBearing(),
        // Um pouco acima do intervalo típico entre amostras de GPS (~1 s): a
        // animação ainda está correndo quando a próxima chega, então o
        // movimento é contínuo em vez de avançar-parar a cada segundo.
        duration: 1100,
        // Linear de propósito. O ease-in-out padrão desacelera no fim de cada
        // animação; encadeadas a 1 Hz, isso vira um "soluço" visível a cada
        // amostra. Linear encadeado dá deslocamento de velocidade constante.
        easing: (t) => t,
        // Mantém o acompanhamento mesmo com "reduzir movimento" ligado no
        // sistema: aqui a animação não é enfeite, é a função do modo navegação.
        essential: true,
      })
    }
  }, [userPoint, followUser, headingDeg, isNavigating])

  // Centralização de disparo único — dispara ao mudar `centerRequestId`, não a
  // cada atualização de `userPoint`, para não competir com o usuário
  // arrastando o mapa livremente.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !userPoint || centerRequestId === 0) return

    if (isNavigating) {
      // Durante a navegação, recentralizar não é só "voltar para o ponto": é
      // restaurar o enquadramento inteiro do modo navegação — posição atual,
      // zoom de rua, o usuário empurrado para baixo na tela pelo padding (com
      // a rota à frente visível) e o mapa apontado para a direção real do
      // deslocamento. Sem isso, quem girasse o mapa sem querer teria que
      // reorientar na mão.
      map.easeTo({
        center: [userPoint.lng, userPoint.lat],
        zoom: NAVIGATION_ZOOM,
        padding: NAVIGATION_PADDING,
        // Sem heading confiável, preserva o ângulo atual em vez de forçar o
        // norte — girar o mapa para uma direção que não é a do movimento
        // desorienta mais do que não girar.
        bearing: headingDeg ?? map.getBearing(),
        // Mais curta que o acompanhamento contínuo e com a aceleração padrão:
        // é um gesto deliberado do usuário, deve responder rápido e assentar.
        duration: 700,
        essential: true,
      })
      return
    }

    map.flyTo({ center: [userPoint.lng, userPoint.lat], zoom: Math.max(map.getZoom(), 15), duration: 800 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerRequestId])

  return <div ref={containerRef} className="absolute inset-0" />
}

function updateMarker(
  ref: React.MutableRefObject<Marker | null>,
  map: MapLibreMap,
  point: LngLat | null,
  kind: 'origin' | 'destination',
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
 * Troca entre ponto azul e scooter conforme a navegação, e aplica a rotação.
 *
 * A troca recria o marcador porque o elemento raiz é outro; recriar a cada
 * atualização de GPS piscaria, então só acontece quando o MODO muda — o
 * `dataset.variant` guarda qual está montado.
 */
function updateUserMarker(
  ref: React.MutableRefObject<Marker | null>,
  map: MapLibreMap,
  point: LngLat | null,
  headingDeg: number | null,
  asVehicle: boolean,
) {
  if (!point) {
    ref.current?.remove()
    ref.current = null
    return
  }

  const variant = asVehicle ? 'vehicle' : 'dot'
  if (ref.current && ref.current.getElement().dataset.variant !== variant) {
    ref.current.remove()
    ref.current = null
  }

  if (!ref.current) {
    const el = asVehicle ? createUserVehicleElement() : createUserDotElement()
    el.dataset.variant = variant
    ref.current = new maplibregl.Marker({
      element: el,
      // Gira junto com o mapa, não com a tela — ver comentário em
      // createUserVehicleElement.
      rotationAlignment: 'map',
    })
  }

  ref.current.setLngLat([point.lng, point.lat]).addTo(map)
  // O disco de fallback é simétrico: rotacioná-lo não muda nada visualmente,
  // mas zerar evita herdar um ângulo do marcador anterior.
  ref.current.setRotation(asVehicle ? (headingDeg ?? 0) : 0)
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
  const setPaint = (layerId: string, property: string, value: string | number) => {
    try {
      map.setPaintProperty(layerId, property, value as never)
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
      if (id.includes('water') || id.includes('ocean') || id.includes('river') || id.includes('lake')) {
        setPaint(layer.id, 'fill-color', C.water)
      } else if (id.includes('building')) {
        // Prédios recuados de propósito. Eram pintados com a cor de via
        // secundária, ou seja, quarteirão e rua tinham exatamente o mesmo
        // tom — impossível ver por onde a rua passa.
        setPaint(layer.id, 'fill-color', C.building)
      } else if (id.includes('park') || id.includes('green') || id.includes('wood') || id.includes('landcover')) {
        setPaint(layer.id, 'fill-color', theme === 'light' ? '#C3DCC3' : '#12251A')
      } else setPaint(layer.id, 'fill-color', C.background)
      continue
    }

    // Prédios em 3D. Esta camada é `fill-extrusion`, um tipo que a função
    // simplesmente NÃO tratava — então permanecia com o bege original do
    // MapTiler (hsl(44,14%,79%)) sobre um mapa azul-acinzentado, virando o
    // elemento mais chamativo da tela enquanto as ruas sumiam. Agora entra na
    // paleta e com opacidade baixa: volume de quarteirão é contexto, não a
    // informação que o usuário está procurando.
    if (layer.type === 'fill-extrusion') {
      setPaint(layer.id, 'fill-extrusion-color', C.building)
      setPaint(layer.id, 'fill-extrusion-opacity', 0.28)
      continue
    }

    if (layer.type === 'line') {
      // Os ids reais do MapTiler são "Highway", "Major road", "Minor road",
      // "Bridge", "Path", "River", "Major rail"… (não "motorway/primary" como
      // em outros provedores) — conferido contra o style.json em uso.
      //
      // A versão anterior tinha só três casos: outline, "via principal" e TODO
      // O RESTO como via secundária. Esse resto incluía rio, ferrovia,
      // fronteira, aqueduto, teleférico, balsa e pista de aeroporto — todos
      // pintados como rua. O mapa ficava cheio de ruas que não existem e o rio
      // virava uma avenida. Daí a categorização explícita abaixo.
      if (id.endsWith('outline')) {
        setPaint(layer.id, 'line-color', C.roadCasing)
      } else if (id.includes('river') || id.includes('water') || id.includes('aqueduct') || id.includes('ferry')) {
        setPaint(layer.id, 'line-color', C.water)
      } else if (id.includes('rail') || id.includes('cablecar') || id.includes('aeroway')) {
        setPaint(layer.id, 'line-color', C.rail)
      } else if (id.includes('border')) {
        // Fronteira não é via. Recua para o fundo em vez de virar mais uma linha.
        setPaint(layer.id, 'line-color', C.building)
      } else if (id.includes('path') || id.includes('footway') || id.includes('pier')) {
        setPaint(layer.id, 'line-color', C.path)
      } else if (id.includes('highway')) {
        setPaint(layer.id, 'line-color', C.roadHighway)
      } else if (id.includes('major road') || id.includes('bridge')) {
        setPaint(layer.id, 'line-color', C.roadMajor)
      } else {
        setPaint(layer.id, 'line-color', C.roadMinor)
      }
      continue
    }

    if (layer.type === 'symbol') {
      setPaint(layer.id, 'text-color', C.label)
      setPaint(layer.id, 'text-halo-color', C.background)
      // Halo mais grosso: o nome da rua é desenhado por cima da própria via, e
      // sem um halo que o descole do traçado o texto compete com a linha.
      setPaint(layer.id, 'text-halo-width', 1.6)
      continue
    }

    if (layer.type === 'circle') {
      setPaint(layer.id, 'circle-color', C.poi)
    }
  }

  emphasizeStreetGrid(map)
}

/**
 * Ajustes de PESO (não de cor) sobre o que o provedor entrega pensando em carro.
 *
 * Este app é para scooter, patinete e bicicleta elétrica: o usuário circula
 * majoritariamente em rua residencial e via local, que é justamente a classe
 * que o MapTiler desenha mais fina (4px, contra 8px de uma via principal).
 * Engrossar a classe menor aproxima o peso visual do uso real sem inverter a
 * hierarquia — via principal continua mais grossa que a local.
 *
 * Também aumenta o corpo do nome de rua, que é lido de relance e em movimento.
 * Tudo protegido por try/catch: se o provedor mudar os ids, o mapa segue
 * funcionando com os pesos originais.
 */
function emphasizeStreetGrid(map: MapLibreMap) {
  const apply = (layerId: string, kind: 'paint' | 'layout', property: string, value: unknown) => {
    try {
      if (!map.getLayer(layerId)) return
      if (kind === 'paint') map.setPaintProperty(layerId, property, value as never)
      else map.setLayoutProperty(layerId, property, value as never)
    } catch {
      // Camada ausente ou propriedade incompatível — segue sem o ajuste.
    }
  }

  apply('Minor road', 'paint', 'line-width', [
    'interpolate',
    ['linear'],
    ['zoom'],
    14,
    ['match', ['get', 'class'], ['secondary'], 5, ['tertiary'], 4, 2.5],
    17,
    ['match', ['get', 'class'], ['secondary'], 9, ['tertiary'], 8, 6],
    20,
    ['match', ['get', 'class'], ['secondary'], 14, ['tertiary'], 13, 11],
  ])
  apply('Minor road outline', 'paint', 'line-width', [
    'interpolate',
    ['linear'],
    ['zoom'],
    14,
    ['match', ['get', 'class'], ['secondary'], 6.5, ['tertiary'], 5.5, 4],
    17,
    ['match', ['get', 'class'], ['secondary'], 11, ['tertiary'], 10, 8],
    20,
    ['match', ['get', 'class'], ['secondary'], 16.5, ['tertiary'], 15.5, 13.5],
  ])
  apply('Road labels', 'layout', 'text-size', [
    'interpolate',
    ['linear'],
    ['zoom'],
    13,
    11,
    16,
    13,
    18,
    15,
    22,
    17,
  ])
}

/**
 * Marcadores sobre o mapa escuro. O do usuário segue a spec do handoff
 * ("LocationPuck"): disco azul 22px com halo translúcido de 48px — bem maior
 * que origem/destino, porque é o elemento vivo da tela.
 */
function markerClassName(kind: 'origin' | 'destination'): string {
  const base = 'h-3.5 w-3.5 rounded-pill border-2 border-surface-map'
  return kind === 'origin' ? `${base} bg-brand-500` : `${base} bg-success-500`
}

/**
 * Marcador do usuário durante a NAVEGAÇÃO.
 *
 * POR QUE NÃO É UMA SCOOTER DESENHADA. Foram testadas cinco silhuetas de
 * scooter/moto vista de cima, renderizadas lado a lado a 300 px e a 56 px:
 * guidão largo com estrado, guidão estreito com rodas escuras, guidão curvo,
 * perspectiva traseira com retrovisores, e rodas exageradas. Nenhuma lê como
 * um veículo — o olho resolve todas como figura humana, garrafa ou camiseta.
 * E isso acontece MESMO a 300 px, o que descarta "é pequeno demais" como
 * explicação: um veículo de duas rodas visto de cima é um corpo estreito e
 * simétrico com um travessão, e essa é a mesma silhueta de um boneco de
 * braços abertos. Insistir renderia um marcador bonito no Figma e ilegível
 * no mapa.
 *
 * O QUE ESTE MARCADOR FAZ. A identidade vem do tratamento, não de um desenho
 * literal — que é a mesma escolha do Google Maps e do Apple Maps:
 * - cone de direção em wedge com gradiente, projetado à frente;
 * - disco com gradiente do azul da marca e aro branco de 2,8px, o que garante
 *   leitura tanto sobre o mapa escuro quanto sobre as vias brancas do tema
 *   claro, sem precisar de duas versões do marcador;
 * - sombra projetada, dando o descolamento do mapa;
 * - seta com o vinco lateral mais claro, que sugere volume sem cair em
 *   pseudo-3D.
 *
 * `rotationAlignment: 'map'` é essencial: a rotação é em relação ao MAPA, não
 * à tela. Como a câmera também gira para o heading, a seta aponta sempre para
 * o topo da tela; e se o usuário girar o mapa com o dedo, ela continua
 * apontando para a direção geográfica correta em vez de seguir o gesto.
 */
function createUserVehicleElement(): HTMLElement {
  const el = document.createElement('div')
  el.className = 'relative flex h-[56px] w-[56px] items-center justify-center'
  el.innerHTML = `
    <svg viewBox="0 0 56 56" class="absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="gs-cone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#35B7F7" stop-opacity="0"/>
          <stop offset="100%" stop-color="#35B7F7" stop-opacity=".7"/>
        </linearGradient>
        <linearGradient id="gs-disc" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#5FCBFF"/>
          <stop offset="55%" stop-color="#2196E8"/>
          <stop offset="100%" stop-color="#0F6ABF"/>
        </linearGradient>
        <filter id="gs-shadow" x="-60%" y="-60%" width="220%" height="220%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.4" flood-color="#04121F" flood-opacity=".5"/>
        </filter>
      </defs>
      <path d="M28 3.5 L43.5 24 A18.5 18.5 0 0 0 12.5 24 Z" fill="url(#gs-cone)"/>
      <circle cx="28" cy="28" r="15.2" fill="url(#gs-disc)" stroke="#FFFFFF" stroke-width="2.8" filter="url(#gs-shadow)"/>
      <g transform="translate(28 28) scale(1.02) translate(-12 -12)">
        <path d="M12 3.6 L18.6 20.4 A0.9 0.9 0 0 1 17.4 21.5 L12 18.9 L6.6 21.5 A0.9 0.9 0 0 1 5.4 20.4 Z" fill="#FFFFFF"/>
        <path d="M12 3.6 L12 18.9 L6.6 21.5 A0.9 0.9 0 0 1 5.4 20.4 Z" fill="#D6EFFF"/>
      </g>
    </svg>
  `
  return el
}

/**
 * Fallback: SEM direção confiável (parado, sinal fraco, navegação não
 * iniciada) o marcador volta a ser um disco com halo de precisão.
 *
 * Mantém a mesma linguagem visual do marcador de veículo — mesmo gradiente,
 * mesmo aro — mas sem a scooter e sem o cone de direção, porque desenhar um
 * veículo apontado para algum lado afirmaria uma orientação que não temos.
 */
function createUserDotElement(): HTMLElement {
  const el = document.createElement('div')
  el.className = 'relative flex h-[44px] w-[44px] items-center justify-center'
  el.innerHTML = `
    <svg viewBox="0 0 44 44" class="absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="gs-dot" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#5CC8FF"/>
          <stop offset="100%" stop-color="#1478D4"/>
        </linearGradient>
        <filter id="gs-dot-shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="1.4" stdDeviation="2" flood-color="#04121F" flood-opacity=".4"/>
        </filter>
      </defs>
      <circle cx="22" cy="22" r="20" fill="#35B7F7" fill-opacity=".18"/>
      <circle cx="22" cy="22" r="9" fill="url(#gs-dot)" stroke="#FFFFFF" stroke-width="2.4" filter="url(#gs-dot-shadow)"/>
    </svg>
  `
  return el
}
