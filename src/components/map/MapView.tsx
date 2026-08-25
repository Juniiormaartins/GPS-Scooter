import { useEffect, useRef } from 'react'
import maplibregl, { Map as MapLibreMap, Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { FALLBACK_DEMO_STYLE_URL, env, isMapConfigured } from '@/config/env'
import { SUPPORTED_REGION, type LngLat } from '@/config/region'
import { MAP_COLORS, MAP_COLORS_LIGHT } from '@/config/theme'
import type { SegmentSeverity } from '@/services/routing/segmentSeverity'
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
  /**
   * Rota ATIVA quebrada em trechos já classificados para o veículo — é o que
   * pinta o traçado com cores diferentes. Vazio: a rota é desenhada inteira na
   * cor principal, usando `routeGeometry`.
   */
  routeSeveritySegments?: RouteSeveritySegment[]
  /** Geometria da alternativa em comparação — desenhada pontilhada ao lado da atual. Vazia = nenhuma. */
  comparisonGeometry?: LngLat[] | null
  /**
   * Trechos que o usuário pediu para EVITAR nas preferências e que mesmo
   * assim entraram na rota. Eixo diferente da severidade acima: severidade é
   * "esta via serve para o seu veículo?", isto é "você pediu para não passar
   * por aqui". Por isso é desenhado como sobreposição tracejada, e não com
   * mais uma cor na linha — duas informações distintas não podem disputar o
   * mesmo canal visual.
   */
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
  /**
   * Velocidade real já filtrada (km/h). Só alimenta o zoom da navegação — a
   * posição e a direção continuam vindo do GPS, não daqui.
   */
  speedKmh?: number | null
  /**
   * Incremente para devolver o mapa ao norte UMA vez (botão de bússola).
   * Mesmo padrão de `centerRequestId`: um token, não um booleano, para que
   * toques repetidos funcionem.
   */
  resetNorthRequestId?: number
  /** Informa o rumo atual do mapa — a agulha da bússola precisa disso para girar. */
  onBearingChange?: (bearingDeg: number) => void
  /** Tema atual — o mapa tem uma paleta própria para cada um (ver config/theme.ts). */
  theme?: 'dark' | 'light'
  onMapReady?: (map: MapLibreMap) => void
}

export interface RouteSeveritySegment {
  path: LngLat[]
  severity: SegmentSeverity
}

const ROUTE_SOURCE_ID = 'gps-scooter-route'
/** Mesma rota, quebrada por trecho — alimenta a linha colorida (o casing segue contínuo, sem emendas). */
const ROUTE_SEGMENTS_SOURCE_ID = 'gps-scooter-route-segments'
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
/**
 * Rota alternativa durante a COMPARAÇÃO (handoff tela 05): casing branco +
 * traço cinza pontilhado. Camada própria porque ela coexiste com a rota
 * ativa e precisa ler como "a outra opção", não como mais uma candidata.
 */
const COMPARE_SOURCE_ID = 'gps-scooter-compare'
const COMPARE_CASING_LAYER_ID = 'gps-scooter-compare-casing'
const COMPARE_LAYER_ID = 'gps-scooter-compare-line'
const ROUTE_WARN_SOURCE_ID = 'gps-scooter-route-warn'
const ROUTE_WARN_LAYER_ID = 'gps-scooter-route-warn-line'

// Zoom "de rua" usado durante a navegação ativa — próximo o bastante para ler
// nomes de rua e a próxima manobra, mas sem escapar do enquadramento útil.
/**
 * Zoom da navegação, por faixa de velocidade.
 *
 * Antes era um valor fixo de 17.5, que em tela de celular dá ~0,8 m por pixel
 * — cerca de 300 m de rua atravessando a tela. Longe demais para ler nome de
 * rua e antecipar cruzamento sem dar zoom na mão.
 *
 * As faixas resolvem a tensão entre "ver a rua" e "ver o caminho à frente":
 * parado ou devagar o que importa é o entorno imediato (onde é a entrada,
 * qual é a esquina); em velocidade, o que importa é enxergar mais adiante,
 * porque a próxima manobra chega antes. Três faixas bastam — mais do que isso
 * vira zoom mudando o tempo todo, que incomoda mais do que ajuda.
 */
const NAVIGATION_ZOOM_BANDS = [
  { upToKmh: 12, zoom: 18.4 },
  { upToKmh: 28, zoom: 18.0 },
  { upToKmh: Number.POSITIVE_INFINITY, zoom: 17.4 },
] as const

/** Usado enquanto não há leitura de velocidade confiável — a faixa urbana típica destes veículos. */
const NAVIGATION_ZOOM_DEFAULT = 18.0

/**
 * Histerese: a faixa só muda quando a velocidade passa do limite com folga.
 * Sem isso, oscilar entre 27 e 29 km/h faria o mapa respirar para dentro e
 * para fora sem parar.
 */
const ZOOM_BAND_HYSTERESIS_KMH = 3

function navigationZoomForSpeed(speedKmh: number | null, currentZoom: number | null): number {
  if (speedKmh == null) return currentZoom ?? NAVIGATION_ZOOM_DEFAULT

  for (let i = 0; i < NAVIGATION_ZOOM_BANDS.length; i += 1) {
    const band = NAVIGATION_ZOOM_BANDS[i]
    if (speedKmh > band.upToKmh) continue

    // Já estamos na faixa seguinte (mais afastada)? Só volta para esta se a
    // velocidade cair abaixo do limite MENOS a folga.
    if (currentZoom != null && currentZoom < band.zoom) {
      const previous = NAVIGATION_ZOOM_BANDS[i - 1]
      const floor = previous ? previous.upToKmh : 0
      if (speedKmh > band.upToKmh - ZOOM_BAND_HYSTERESIS_KMH && speedKmh > floor) return currentZoom
    }
    return band.zoom
  }

  return NAVIGATION_ZOOM_DEFAULT
}
// Reserva espaço no TOPO do mapa (onde fica o cartão de instrução) — isso
// empurra o ponto centralizado (o usuário) para a parte inferior da tela,
// deixando a rota à frente visível acima dele, como num app de navegação real.
const NAVIGATION_PADDING = { top: 300, bottom: 32, left: 0, right: 0 }

/**
 * Inclinação da câmera na navegação, em graus.
 *
 * Fora da navegação o mapa continua reto (pitch 0): ali o usuário está
 * lendo a cidade e comparando rotas, e perspectiva atrapalha essa leitura.
 * Dentro da navegação a inclinação é o que dá a sensação de deslocamento e
 * empurra o horizonte para longe, mostrando mais caminho à frente sem
 * precisar afastar o zoom.
 *
 * 52° é o meio-termo: perto do que os GPS de referência usam, o suficiente
 * para a perspectiva aparecer, e ainda abaixo do ponto em que as ruas ao
 * fundo se achatam e os nomes ficam ilegíveis (a partir de ~60° o texto
 * comprime demais).
 */
const NAVIGATION_PITCH = 52

/**
 * Largura da rota, por estado e por zoom.
 *
 * A rota era 5px FIXOS. Como as vias locais foram engrossadas para 6px no
 * zoom de navegação e uma secundária chega a 9px, a rota ficava mais FINA que
 * a rua sobre a qual ela é desenhada — dava para perder o traçado de relance,
 * que é justamente quando ele precisa ser óbvio.
 *
 * Agora escala com o zoom (uma largura fixa fica grossa demais afastado e
 * fina demais aproximado) e tem três pesos:
 *
 * - 'navigating': o mais grosso. É o único momento em que existe UMA rota e
 *   a única pergunta na cabeça do usuário é "por onde eu sigo?".
 * - 'confirmed': tela de escolha. Precisa se destacar, mas divide a tela com
 *   as alternativas e com o mapa que o usuário está avaliando.
 * - 'preview': ainda é uma sugestão, antes de "Traçar rota" — o peso menor
 *   faz parte de comunicar isso.
 *
 * No zoom 17–18 da navegação a rota fica em ~11–13px contra 6px de uma rua
 * local: aproximadamente o dobro, que é a proporção da referência.
 */
type RouteLineWeight = 'navigating' | 'confirmed' | 'preview'

const ROUTE_WIDTH_BY_WEIGHT: Record<RouteLineWeight, [number, number, number]> = {
  // [z14, z17, z20]
  navigating: [6, 11, 18],
  confirmed: [5, 8, 13],
  preview: [4, 6.5, 10],
}

/** Contorno: sempre mais largo que a linha, é ele que separa a rota do asfalto embaixo. */
const ROUTE_CASING_EXTRA_PX = 4.5

const ZERO_PADDING = { top: 0, bottom: 0, left: 0, right: 0 }

interface FramePadding {
  top: number
  bottom: number
  left: number
  right: number
}

/**
 * Enquadra a câmera num conjunto de coordenadas, sem estourar o transform.
 *
 * BUG REAL, reproduzido de forma determinística: o MapLibre SOMA o padding já
 * gravado no transform ao padding passado para `fitBounds`. O acompanhamento
 * da navegação deixa `{ top: 300, bottom: 32 }` gravado. Ao sair, o
 * enquadramento das candidatas pedia `{ top: 220, bottom: 260 }` — somando
 * 520 em cima e 292 embaixo, exatamente os 812 px de altura do mapa. Altura
 * útil zero, divisão por zero, `unproject` devolvendo NaN, e o componente
 * inteiro caindo com "Invalid LngLat object: (NaN, -90)".
 *
 * Ficava escondido enquanto App.tsx tinha DOIS MapView em ramos de return
 * diferentes: sair da navegação remontava o mapa, e o mapa novo nascia sem
 * padding. Unificar numa instância só — que é o certo, para não rebaixar todos
 * os tiles a cada navegação — expôs o problema.
 *
 * Zerar o padding ANTES de enquadrar é o que trata a causa: não adianta só
 * limitar o valor pedido, porque o termo somado vem do estado do mapa (e
 * durante a animação de saída ele é um valor intermediário qualquer). O limite
 * proporcional continua como segunda defesa, para telas pequenas em que o
 * padding pedido estoura sozinho.
 */
function fitToBounds(
  map: MapLibreMap,
  bounds: maplibregl.LngLatBounds,
  desired: FramePadding,
  options: { duration: number; maxZoom?: number },
) {
  const canvas = map.getCanvas()
  const ratio = window.devicePixelRatio || 1
  const width = canvas.width / ratio
  const height = canvas.height / ratio
  if (width <= 0 || height <= 0) return

  // Remove o termo aditivo antes de medir e enquadrar.
  map.setPadding(ZERO_PADDING)

  // Sobra mínima de 25% em cada eixo para a geometria — abaixo disso o
  // enquadramento deixa de descrever qualquer coisa útil, mesmo sem estourar.
  const scaleAxis = (a: number, b: number, available: number): [number, number] => {
    const total = a + b
    const budget = available * 0.75
    if (total <= budget) return [a, b]
    const factor = budget / total
    return [a * factor, b * factor]
  }

  const [top, bottom] = scaleAxis(desired.top, desired.bottom, height)
  const [left, right] = scaleAxis(desired.left, desired.right, width)

  // Enquadrar é sempre uma ação de FORA da navegação (ver as guardas nos
  // efeitos que chamam isto), e lá o mapa é reto e ao norte. Sem declarar
  // isso, `fitBounds` preserva o ângulo atual — e o mapa ficava inclinado a
  // 52° depois de encerrar uma navegação, porque o enquadramento das
  // candidatas rodava DEPOIS da animação que endireita a câmera.
  map.fitBounds(bounds, { padding: { top, bottom, left, right }, bearing: 0, pitch: 0, ...options })
}

function routeWidthExpression(weight: RouteLineWeight, casing = false): maplibregl.ExpressionSpecification {
  const [z14, z17, z20] = ROUTE_WIDTH_BY_WEIGHT[weight]
  const extra = casing ? ROUTE_CASING_EXTRA_PX : 0
  return ['interpolate', ['linear'], ['zoom'], 14, z14 + extra, 17, z17 + extra, 20, z20 + extra]
}

/**
 * Cor da linha por severidade do trecho.
 *
 * Reaproveita as cores de elegibilidade que já existem na paleta em vez de
 * introduzir um terceiro conjunto: âmbar e vermelho já significam "com
 * ressalva" e "não recomendada" no resto do app (selo da rota, cards), então
 * a linha do mapa passa a falar a mesma língua dos rótulos ao lado dela.
 *
 * O trecho adequado usa o azul da marca, não verde: verde no traçado
 * competiria com o âmbar/vermelho por atenção justamente onde o azul já
 * significa "este é o seu caminho" em toda a interface.
 */
function severityColor(theme: 'dark' | 'light'): maplibregl.ExpressionSpecification {
  const palette = routePalette(theme)
  return [
    'match',
    ['get', 'severity'],
    'critical',
    palette.routeByEligibility['not-allowed'],
    'attention',
    palette.routeByEligibility.discouraged,
    palette.routeSelected,
  ]
}

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
  routeSeveritySegments = [],
  comparisonGeometry = null,
  routeWarnings = [],
  isRoutePreview = false,
  isNavigating = false,
  speedKmh = null,
  resetNorthRequestId = 0,
  onBearingChange,
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
  /** Zoom de navegação em vigor — entrada da histerese entre faixas de velocidade. */
  const navigationZoomRef = useRef<number | null>(null)
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
      map.addSource(ROUTE_SEGMENTS_SOURCE_ID, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })

      map.addLayer({
        id: ROUTE_CASING_LAYER_ID,
        type: 'line',
        source: ROUTE_SOURCE_ID,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': routePalette(themeRef.current).routeCasing,
          'line-width': routeWidthExpression('confirmed', true),
          'line-opacity': 0.9,
        },
      })
      map.addLayer({
        id: ROUTE_LAYER_ID,
        type: 'line',
        source: ROUTE_SEGMENTS_SOURCE_ID,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': severityColor(themeRef.current),
          'line-width': routeWidthExpression('confirmed'),
          'line-opacity': 0.95,
        },
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
      map.addSource(COMPARE_SOURCE_ID, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({
        id: COMPARE_CASING_LAYER_ID,
        type: 'line',
        source: COMPARE_SOURCE_ID,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#FFFFFF', 'line-width': 14, 'line-opacity': 0.9 },
      })
      map.addLayer({
        id: COMPARE_LAYER_ID,
        type: 'line',
        source: COMPARE_SOURCE_ID,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#94A3B8', 'line-width': 8, 'line-dasharray': [2, 2.4] },
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
    navigationZoomRef.current = null
    // Fora da navegação, mapa reto e ao norte — é o estado em que dá para
    // comparar alternativas e entender a cidade.
    // O padding precisa ser zerado, não só o ângulo: ele fica GRAVADO no
    // transform pelo acompanhamento e é somado a qualquer `fitBounds`
    // posterior (ver fitToBounds).
    map.easeTo({ bearing: 0, pitch: 0, padding: ZERO_PADDING, duration: 400 })
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
      repaint(ROUTE_LAYER_ID, severityColor(theme))
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

  useEffect(() => {
    const map = mapRef.current
    const source = map?.getSource(COMPARE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined
    if (!map || !source) return

    const coordinates = (comparisonGeometry ?? []).map((point) => [point.lng, point.lat] as [number, number])
    source.setData({
      type: 'FeatureCollection',
      features:
        coordinates.length >= 2
          ? [{ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates } }]
          : [],
    })
  }, [comparisonGeometry])

  // Preview vs. rota confirmada: mesma cor e mesma geometria real, só com
  // peso menor. A distinção forte entre os dois estados é estrutural — no
  // preview existe UMA linha, depois de "Traçar rota" existem as alternativas
  // coloridas por elegibilidade e uma delas destacada como ativa.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getLayer(ROUTE_LAYER_ID)) return

    const weight: RouteLineWeight = isNavigating ? 'navigating' : isRoutePreview ? 'preview' : 'confirmed'
    map.setPaintProperty(ROUTE_LAYER_ID, 'line-width', routeWidthExpression(weight))
    map.setPaintProperty(ROUTE_LAYER_ID, 'line-opacity', weight === 'preview' ? 0.75 : 0.95)
    if (map.getLayer(ROUTE_CASING_LAYER_ID)) {
      map.setPaintProperty(ROUTE_CASING_LAYER_ID, 'line-width', routeWidthExpression(weight, true))
    }
    // O destaque dos trechos evitados acompanha a rota: fixo, ele sumiria
    // dentro da linha grossa da navegação.
    if (map.getLayer(ROUTE_WARN_LAYER_ID)) {
      map.setPaintProperty(ROUTE_WARN_LAYER_ID, 'line-width', [
        'interpolate',
        ['linear'],
        ['zoom'],
        14,
        weight === 'navigating' ? 4 : 3,
        17,
        weight === 'navigating' ? 7 : 5,
        20,
        weight === 'navigating' ? 12 : 8,
      ] as maplibregl.ExpressionSpecification)
    }
  }, [isRoutePreview, isNavigating])

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

    // O casing continua sendo UMA linha contínua: quebrado por trecho, ele
    // deixaria emendas visíveis em cada junção.
    source.setData({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates },
    })

    const segmentSource = map.getSource(ROUTE_SEGMENTS_SOURCE_ID) as maplibregl.GeoJSONSource | undefined
    if (segmentSource) {
      const usable = routeSeveritySegments.filter((segment) => segment.path.length >= 2)
      segmentSource.setData({
        type: 'FeatureCollection',
        // Sem classificação por trecho (rota sem segmentos, enriquecimento que
        // não respondeu), desenha a rota inteira como adequada em vez de
        // deixar o mapa sem traçado — e "adequada" aqui é o padrão honesto:
        // não afirmamos problema onde não temos dado.
        features: usable.length
          ? usable.map((segment) => ({
              type: 'Feature' as const,
              properties: { severity: segment.severity },
              geometry: {
                type: 'LineString' as const,
                coordinates: segment.path.map((point) => [point.lng, point.lat]),
              },
            }))
          : coordinates.length >= 2
            ? [
                {
                  type: 'Feature' as const,
                  properties: { severity: 'suitable' },
                  geometry: { type: 'LineString' as const, coordinates },
                },
              ]
            : [],
      })
    }

    // Centraliza e enquadra a câmera na rota recém-calculada, com respiro para
    // não ficar escondida atrás do cabeçalho de busca (topo) e do RoutePanel (base).
    // Durante a navegação a câmera pertence ao acompanhamento: enquadrar aqui
    // arrancaria a vista de cima do usuário no instante em que a rota muda
    // (aceitar uma alternativa, recalcular por desvio).
    if (coordinates.length >= 2 && !isNavigating) {
      const bounds = coordinates.reduce(
        (acc, coord) => acc.extend(coord),
        new maplibregl.LngLatBounds(coordinates[0], coordinates[0]),
      )
      fitToBounds(map, bounds, { top: 220, bottom: 220, left: 48, right: 48 }, { duration: 600 })
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
    if (allCoordinates.length >= 2 && !isNavigating) {
      const bounds = allCoordinates.reduce(
        (acc, coord) => acc.extend(coord),
        new maplibregl.LngLatBounds(allCoordinates[0], allCoordinates[0]),
      )
      fitToBounds(map, bounds, { top: 220, bottom: 260, left: 48, right: 48 }, { duration: 600 })
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

    if (isNavigating) return

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
    fitToBounds(map, bounds, { top: 180, bottom: 300, left: 56, right: 56 }, { duration: 700, maxZoom: 16 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destinationPoint])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    // Marcador personalizado durante TODA a navegação. A condição antes
    // incluía `headingDeg != null`, e isso o escondia justamente no começo do
    // percurso: a direção só é liberada acima de 3 km/h e `coords.heading` vem
    // null com o aparelho parado. Quem ligava a navegação parado via o disco
    // genérico. A direção agora é tratada dentro do próprio marcador (ver
    // setVehicleHeadingVisibility), não pela troca do marcador inteiro.
    updateUserMarker(userMarkerRef, map, userPoint, headingDeg, isNavigating)

    if (followUser && userPoint) {
      const zoom = navigationZoomForSpeed(speedKmh, navigationZoomRef.current)
      navigationZoomRef.current = zoom
      map.easeTo({
        center: [userPoint.lng, userPoint.lat],
        zoom,
        pitch: NAVIGATION_PITCH,
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
  }, [userPoint, followUser, headingDeg, isNavigating, speedKmh])

  useEffect(() => {
    const map = mapRef.current
    if (!map || resetNorthRequestId === 0) return
    // Só o rumo volta ao norte. Zoom, centro e inclinação ficam como estão:
    // a bússola responde "onde é o norte", não "reenquadre tudo".
    map.easeTo({ bearing: 0, duration: 400, essential: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetNorthRequestId])

  // Espelha o rumo do mapa para fora, para a agulha da bússola girar junto.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !onBearingChange) return
    const report = () => onBearingChange(map.getBearing())
    map.on('rotate', report)
    report()
    return () => {
      map.off('rotate', report)
    }
  }, [onBearingChange])

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
      const zoom = navigationZoomForSpeed(speedKmh, navigationZoomRef.current)
      navigationZoomRef.current = zoom
      map.easeTo({
        center: [userPoint.lng, userPoint.lat],
        zoom,
        // Recentralizar também restaura a perspectiva: se o usuário achatou o
        // mapa com dois dedos, o toque devolve o enquadramento de navegação
        // inteiro, não só a posição.
        pitch: NAVIGATION_PITCH,
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

  if (asVehicle) {
    setVehicleHeadingVisibility(ref.current.getElement(), headingDeg != null)
  }
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
  el.className = 'relative flex h-[68px] w-[68px] items-center justify-center'
  el.innerHTML = `
    <svg viewBox="0 0 68 68" class="absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="gs-cone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#35B7F7" stop-opacity="0"/>
          <stop offset="100%" stop-color="#35B7F7" stop-opacity=".72"/>
        </linearGradient>
        <linearGradient id="gs-disc" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#5FCBFF"/>
          <stop offset="55%" stop-color="#2196E8"/>
          <stop offset="100%" stop-color="#0F6ABF"/>
        </linearGradient>
        <filter id="gs-shadow" x="-60%" y="-60%" width="220%" height="220%">
          <feDropShadow dx="0" dy="2.4" stdDeviation="3" flood-color="#04121F" flood-opacity=".5"/>
        </filter>
      </defs>
      <path data-role="cone" d="M34 4 L53 29 A23 23 0 0 0 15 29 Z" fill="url(#gs-cone)"/>
      <circle cx="34" cy="34" r="18.5" fill="url(#gs-disc)" stroke="#FFFFFF" stroke-width="3.2" filter="url(#gs-shadow)"/>
      <g data-role="arrow" transform="translate(34 34) scale(1.25) translate(-12 -12)">
        <path d="M12 3.6 L18.6 20.4 A0.9 0.9 0 0 1 17.4 21.5 L12 18.9 L6.6 21.5 A0.9 0.9 0 0 1 5.4 20.4 Z" fill="#FFFFFF"/>
        <path d="M12 3.6 L12 18.9 L6.6 21.5 A0.9 0.9 0 0 1 5.4 20.4 Z" fill="#D6EFFF"/>
      </g>
      <circle data-role="idle" cx="34" cy="34" r="7.5" fill="#FFFFFF" opacity="0"/>
    </svg>
  `
  return el
}

/**
 * Liga/desliga a afirmação de DIREÇÃO dentro do marcador.
 *
 * O marcador personalizado passa a ser usado durante toda a navegação — antes
 * ele exigia `headingDeg != null` e, como a direção só é liberada acima de
 * 3 km/h (e `coords.heading` vem null parado), na prática TODA navegação
 * começava mostrando o disco genérico. Era o bug relatado: "continuo vendo o
 * ponto azul".
 *
 * O que continua condicionado ao dado é a direção, não o marcador: sem
 * heading confiável, o cone e a seta somem e fica um núcleo redondo. Assim o
 * usuário nunca vê uma seta apontando para um lado que não medimos.
 */
function setVehicleHeadingVisibility(element: HTMLElement, hasHeading: boolean) {
  const cone = element.querySelector('[data-role="cone"]') as SVGElement | null
  const arrow = element.querySelector('[data-role="arrow"]') as SVGElement | null
  const idle = element.querySelector('[data-role="idle"]') as SVGElement | null
  if (cone) cone.style.opacity = hasHeading ? '1' : '0'
  if (arrow) arrow.style.opacity = hasHeading ? '1' : '0'
  if (idle) idle.style.opacity = hasHeading ? '0' : '1'
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
  el.className = 'relative flex h-[96px] w-[96px] items-center justify-center'
  // `RiderPuck`, estado 2D (handoff §5.2): halo pulsante de 96px, disco branco
  // de 40px com núcleo azul de 30px e glyph de RAIO — identidade de mobilidade
  // elétrica, não o ponto azul genérico de mapa.
  //
  // O cone de direção do handoff não é desenhado aqui: fora da navegação não
  // temos rumo confiável (o heading do GPS só é liberado acima de 3 km/h), e
  // um cone apontando para um lado arbitrário afirmaria direção que não
  // medimos. Ele aparece no marcador de navegação, onde há rumo.
  el.innerHTML = `
    <svg viewBox="0 0 96 96" class="absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <filter id="gs-puck-shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#0F1729" flood-opacity=".22"/>
        </filter>
      </defs>
      <circle cx="48" cy="48" r="48" fill="rgba(14,134,198,.16)">
        <animate attributeName="r" values="41;70;70" dur="2.6s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values=".55;0;0" dur="2.6s" repeatCount="indefinite"/>
      </circle>
      <circle cx="48" cy="48" r="20" fill="#FFFFFF" filter="url(#gs-puck-shadow)"/>
      <circle cx="48" cy="48" r="15" fill="#0E86C6"/>
      <path d="M50.6 39.2 44.1 48.6h4.2l-2.9 8.2 6.5-9.4h-4.2z" fill="#FFFFFF"/>
    </svg>
  `
  return el
}
