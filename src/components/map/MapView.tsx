import { useEffect, useRef, useState } from 'react'
import maplibregl, { Map as MapLibreMap, Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { FALLBACK_DEMO_STYLE_URL, env, isMapConfigured } from '@/config/env'
import { SUPPORTED_REGION, type LngLat } from '@/config/region'
import { ACCENT, MAP_COLORS, MAP_COLORS_LIGHT, ROUTE_RIBBON, SEVERITY_RIM, SEVERITY_SHEEN } from '@/config/theme'
import type { SegmentSeverity } from '@/services/routing/segmentSeverity'
import { applyPoiIcons } from '@/components/map/poiIcons'
import { applySuitabilityLayer } from '@/components/map/suitabilityLayer'
import { DESTINATION_ASSETS, DESTINATION_SIZES } from '@/components/map/poiLibrary'
import { RiderAnimator, type RiderFrame } from '@/components/map/riderAnimator'
import {
  hasRiderSprites,
  MIN_LEGIBLE_SPRITE_PX,
  probeRiderSprites,
  riderSpriteUrl,
  SHARED_ASSETS,
  SPRITE_ANCHOR_Y,
} from '@/components/map/riderMarker'
import type { VehicleModelId } from '@/config/userPreferences'
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
   * Veículo escolhido no perfil. Decide QUAL família de sprites o marcador usa
   * — a troca é só de asset: âncora, halo e cone são idênticos nos três.
   */
  vehicleModelId?: VehicleModelId
  /** Camada de adequação das vias ligada (ver suitabilityLayer.ts). */
  suitabilityLayer?: boolean
  /**
   * Raio de alcance a desenhar em volta do usuário, em km. null = não desenhar.
   *
   * É o modo explorar: transforma "30 km de autonomia" numa resposta
   * geográfica. Ver ExploreSheet.
   */
  rangeRingKm?: number | null
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
const RANGE_RING_SOURCE_ID = 'gps-scooter-range-ring'
const RANGE_RING_FILL_LAYER_ID = 'gps-scooter-range-ring-fill'
const RANGE_RING_LINE_LAYER_ID = 'gps-scooter-range-ring-line'
/** Mesma rota, quebrada por trecho — alimenta a linha colorida (o casing segue contínuo, sem emendas). */
const ROUTE_SEGMENTS_SOURCE_ID = 'gps-scooter-route-segments'
/**
 * Brilho da rota. Duas camadas largas e translúcidas por baixo do traçado
 * fingem o bloom da referência.
 *
 * O MapLibre não tem pós-processamento — não existe bloom de verdade. O que
 * dá para fazer é empilhar linhas cada vez mais largas e mais transparentes,
 * o que produz um halo com degrau em vez de degradê contínuo. Duas camadas
 * bastam: com uma o halo tem borda dura, com quatro o custo de preenchimento
 * sobe sem ganho visível num traçado fino.
 */
const ROUTE_GLOW_OUTER_LAYER_ID = 'gps-scooter-route-glow-outer'
const ROUTE_GLOW_INNER_LAYER_ID = 'gps-scooter-route-glow-inner'
const ROUTE_CASING_LAYER_ID = 'gps-scooter-route-casing'
/**
 * Contorno interno da fita, POR TRECHO.
 *
 * Fica entre o vinco externo (casing) e o miolo. É esta camada que dá a
 * impressão de espessura da referência. Vem da fonte SEGMENTADA, e não da
 * contínua, justamente para escurecer na cor de cada severidade — um trecho
 * vermelho com contorno azul-marinho pareceria dois elementos sobrepostos.
 */
const ROUTE_RIM_LAYER_ID = 'gps-scooter-route-rim'
const ROUTE_LAYER_ID = 'gps-scooter-route-line'
/**
 * Brilho central: linha estreita e translúcida sobre o eixo do miolo.
 *
 * É o truque mais barato para sugerir volume sem gradiente de verdade — o
 * olho lê centro claro + bordas escuras como uma superfície curva. Estreita de
 * propósito (~30% do miolo): mais larga que isso e a fita fica lavada em vez
 * de brilhante.
 */
const ROUTE_SHEEN_LAYER_ID = 'gps-scooter-route-sheen'
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
/**
 * ÚLTIMO TRECHO até o destino, tracejado.
 *
 * O roteador chega à VIA mais próxima do destino; quando o destino é o centro
 * de uma praça, de um campus ou de um shopping, isso pode ser mais de cem
 * metros antes. Medido: "Praça Cívica" fica a 133 m do fim do traçado.
 *
 * Sem nada ali, a rota simplesmente para e o pino fica solto do outro lado —
 * a leitura de "aproximação → chegada" se perde. Emendar com linha cheia
 * seria pior: afirmaria um caminho que não foi roteado e que pode atravessar
 * quarteirão.
 *
 * Tracejado é a convenção que resolve os dois: liga visualmente e diz que
 * aquele pedaço não é rota calculada, e sim os últimos metros por conta do
 * usuário.
 */
const ROUTE_APPROACH_SOURCE_ID = 'gps-scooter-route-approach'
const ROUTE_APPROACH_LAYER_ID = 'gps-scooter-route-approach-line'
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
/**
 * Área RESERVADA da tela durante a navegação. O ponto centralizado é o centro
 * do que sobra, então este padding é o que decide onde o marcador aparece.
 *
 * `bottom` era 32px, o que ignorava a faixa inferior inteira — banner de
 * velocidade, etiqueta da via atual e o painel de ETA. O marcador caía atrás
 * deles. Reservar ~200px empurra o marcador para ~56% da altura: acima do
 * chrome de baixo, com o caminho à frente ocupando a metade superior.
 */
const NAVIGATION_PADDING = { top: 300, bottom: 200, left: 0, right: 0 }

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
  //
  // Subidas em relação à versão anterior ([6,11,18] / [5,8,13] / [4,6.5,10]).
  // O pedido era que a rota deixasse de parecer "encaixada" na largura da rua
  // e passasse a ser claramente mais larga que ela, como na referência. No
  // zoom 17 da navegação uma via local do MapTiler tem ~6px: com 15px o miolo
  // sozinho já é 2,5x a rua, e somando contorno e vinco a fita ocupa ~24px —
  // a proporção da imagem de referência.
  navigating: [8, 15, 24],
  confirmed: [7, 12, 19],
  preview: [5, 8.5, 13],
}

/** Vinco externo — separa a fita do mapa. */
const ROUTE_CASING_EXTRA_PX = 9
/** Contorno de profundidade — 2,5px de cada lado do miolo. */
const ROUTE_RIM_EXTRA_PX = 5
/** Brilho central, como fração do miolo. */
const ROUTE_SHEEN_FACTOR = 0.3

/**
 * Fração do erro que zoom e inclinação eliminam por quadro.
 *
 * 0,08 a 60 Hz converge em ~0,6 s — rápido o bastante para não parecer
 * preguiçoso ao entrar na navegação, lento o bastante para a troca de faixa de
 * zoom não ser percebida como solavanco.
 */
const CAMERA_CHASE = 0.08

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

/** Largura do halo: um múltiplo da largura da rota, para o brilho acompanhar o zoom. */
function routeGlowWidth(weight: RouteLineWeight, factor: number): maplibregl.ExpressionSpecification {
  const [z14, z17, z20] = ROUTE_WIDTH_BY_WEIGHT[weight]
  return ['interpolate', ['linear'], ['zoom'], 14, z14 * factor, 17, z17 * factor, 20, z20 * factor]
}

function routeWidthExpression(weight: RouteLineWeight, extra = 0): maplibregl.ExpressionSpecification {
  const [z14, z17, z20] = ROUTE_WIDTH_BY_WEIGHT[weight]
  return ['interpolate', ['linear'], ['zoom'], 14, z14 + extra, 17, z17 + extra, 20, z20 + extra]
}

/**
 * Distância máxima para EMENDAR o fim da rota ao destino.
 *
 * O provedor traça até o ponto da VIA mais próximo do destino, que fica a
 * alguns metros da porta. Sem emendar, a linha para antes e o pino aparece
 * solto ao lado dela — a leitura vira "bolinha jogada sobre o mapa", que é o
 * que o pacote pede para evitar.
 *
 * 80 m é o limite do que ainda são "os últimos metros". Além disso a emenda
 * deixaria de descrever um acesso e passaria a inventar um caminho reto
 * atravessando quarteirão, então nesse caso a linha termina onde a via
 * termina e a tampa vai para lá — o pino continua marcando o lugar.
 */
const ARRIVAL_JOIN_METERS = 80

function metersBetween(a: LngLat, b: LngLat): number {
  const R = 6371000
  const toRad = Math.PI / 180
  const dLat = (b.lat - a.lat) * toRad
  const dLng = (b.lng - a.lng) * toRad
  const lat1 = a.lat * toRad
  const lat2 = b.lat * toRad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Geometria com o último ponto emendado ao destino, quando ele está por perto. */
function joinToDestination(points: LngLat[], destination: LngLat | null): LngLat[] {
  if (!destination || points.length < 2) return points
  const last = points[points.length - 1]
  const gap = metersBetween(last, destination)
  if (gap < 1 || gap > ARRIVAL_JOIN_METERS) return points
  return [...points, destination]
}

/** Onde a tampa de chegada deve ficar: no destino se a rota o alcança, senão no fim da via. */
function arrivalPointFor(points: LngLat[], destination: LngLat | null): LngLat | null {
  if (!destination) return null
  if (points.length < 2) return destination
  const last = points[points.length - 1]
  return metersBetween(last, destination) > ARRIVAL_JOIN_METERS ? last : destination
}

/** Paleta da fita no tema atual. */
function ribbon(theme: 'dark' | 'light') {
  return theme === 'light' ? ROUTE_RIBBON.light : ROUTE_RIBBON.dark
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
    // Trecho adequado: azul da FITA, não `routeSelected`. Mesma família, mais
    // saturado — ver ROUTE_RIBBON em config/theme.ts.
    ribbon(theme).core,
  ]
}

/**
 * Cor do contorno de profundidade, por severidade.
 *
 * Espelha `severityColor`: cada trecho recebe a versão escurecida da SUA cor,
 * então o acabamento novo se soma à sinalização em vez de disputar com ela.
 */
function severityRimColor(theme: 'dark' | 'light'): maplibregl.ExpressionSpecification {
  return [
    'match',
    ['get', 'severity'],
    'critical',
    SEVERITY_RIM.critical,
    'attention',
    SEVERITY_RIM.attention,
    ribbon(theme).rim,
  ]
}

/**
 * Cor do brilho central, por severidade — ver SEVERITY_SHEEN.
 *
 * Precisa acompanhar a severidade pelo mesmo motivo do contorno: uma camada
 * clara FIXA por cima do miolo tinge o que está embaixo. Azul sobre vermelho
 * dá marrom, e o trecho não recomendado deixava de parecer não recomendado.
 */
function severitySheenColor(theme: 'dark' | 'light'): maplibregl.ExpressionSpecification {
  return [
    'match',
    ['get', 'severity'],
    'critical',
    SEVERITY_SHEEN.critical,
    'attention',
    SEVERITY_SHEEN.attention,
    ribbon(theme).sheen,
  ]
}

/**
 * Cor do halo, por severidade.
 *
 * O halo era azul mesmo em volta de um trecho vermelho — um contorno luminoso
 * da cor errada em torno do aviso. Passou a sair da fonte SEGMENTADA para
 * poder acompanhar; o desfoque de 5–10px cobre qualquer emenda entre trechos.
 */
function severityGlowColor(theme: 'dark' | 'light'): maplibregl.ExpressionSpecification {
  const palette = routePalette(theme)
  return [
    'match',
    ['get', 'severity'],
    'critical',
    palette.routeByEligibility['not-allowed'],
    'attention',
    palette.routeByEligibility.discouraged,
    ribbon(theme).glow,
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
  vehicleModelId = 'scooter-32',
  suitabilityLayer = false,
  rangeRingKm = null,
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
  /**
   * Tampa de chegada — o disco onde o traçado termina.
   *
   * É um marcador SEPARADO do pino, e não um enfeite dentro dele, porque a
   * ordem de empilhamento é o ponto todo: rota → tampa → pino. Com um
   * elemento só, a linha da rota passaria por baixo do pino e a chegada leria
   * como "uma bolinha jogada sobre a linha", que é exatamente o que o pacote
   * pede para evitar.
   */
  const arrivalCapRef = useRef<Marker | null>(null)
  const userMarkerRef = useRef<Marker | null>(null)
  /** Zoom de navegação em vigor — entrada da histerese entre faixas de velocidade. */
  const navigationZoomRef = useRef<number | null>(null)
  /** Há candidatas na tela? Decide visibilidade das camadas e intensidade do halo. */
  const showingOptions = routeOptions.length > 0

  /**
   * O destino está em zoom compacto?
   *
   * O pacote pede que abaixo de ~14 o pino dê lugar ao ponto: um pino de 56px
   * num enquadramento de cidade inteira cobre quarteirões e deixa de indicar
   * um lugar. Guardado como BOOLEANO, não como o zoom: assim o efeito só
   * re-renderiza na travessia do limiar, e não a cada fração de zoom.
   */
  const [destinationCompact, setDestinationCompact] = useState(false)

  /**
   * Interpolador do deslocamento. Ver riderAnimator.ts.
   *
   * Uma instância por montagem do mapa. Marcador e câmera são atualizados a
   * partir dele, no MESMO quadro — é isso que garante que a câmera não fique
   * atrás do marcador.
   */
  const riderRef = useRef<RiderAnimator | null>(null)
  if (!riderRef.current) riderRef.current = new RiderAnimator()

  /**
   * Valores lidos DENTRO do laço de quadro.
   *
   * Precisam ser refs e não dependências: se o efeito que liga o laço
   * dependesse de `followUser`, `speedKmh` ou do veículo, o laço seria
   * derrubado e recriado a cada amostra de velocidade — e a interpolação
   * recomeçaria do zero, reintroduzindo exatamente o pulo que ela existe para
   * eliminar.
   */
  // A ref é atualizada mais abaixo, DEPOIS de `cameraRef`: a transição
  // false → true precisa ser detectada antes da atribuição.
  const followUserRef = useRef(followUser)
  const speedKmhRef = useRef(speedKmh)
  speedKmhRef.current = speedKmh
  const vehicleRef = useRef(vehicleModelId)
  vehicleRef.current = vehicleModelId
  const suitabilityRef = useRef(suitabilityLayer)
  suitabilityRef.current = suitabilityLayer
  /** Zoom e inclinação exibidos — perseguem o alvo por quadro, ver cameraRef. */
  const cameraRef = useRef<{ zoom: number | null; pitch: number }>({ zoom: null, pitch: 0 })

  /**
   * Há um gesto do usuário em andamento?
   *
   * ISTO É O QUE DESTRAVA O MAPA NA NAVEGAÇÃO. O laço de quadro chamava
   * `map.jumpTo` 60 vezes por segundo, e cada chamada reescreve o transform.
   * O `DragPanHandler` do MapLibre acumula o deslocamento do dedo ENTRE os
   * eventos de ponteiro, comparando com o transform corrente — com um
   * `jumpTo` no meio de cada par de eventos, o acumulado era apagado antes de
   * atingir o limiar do gesto. Resultado medido: arrastar movia o mapa 8 m e
   * `dragstart` NUNCA disparava; como é ele que desliga o acompanhamento, o
   * mapa ficava preso em si mesmo.
   *
   * Marcado a partir do evento de ponteiro BRUTO, e não de um evento do
   * MapLibre, justamente porque os eventos dele dependiam do gesto conseguir
   * começar — o que era o problema.
   */
  const gestureActiveRef = useRef(false)

  /**
   * Retomando o acompanhamento depois de o usuário mexer no mapa, a
   * perseguição de zoom e inclinação recomeça DO VALOR ATUAL da câmera.
   *
   * Sem isto, `cameraRef` guardaria o zoom de antes da interação e o primeiro
   * quadro do acompanhamento saltaria do zoom escolhido pelo usuário direto
   * para o da navegação. Partindo do valor corrente, a câmera volta ao
   * enquadramento de navegação suavemente, junto com a animação de
   * recentralização.
   *
   * Comparação feita ANTES de atualizar a ref abaixo — é a transição
   * false → true que interessa, não o valor em si.
   */
  if (followUser && !followUserRef.current) {
    const mapaAtual = mapRef.current
    if (mapaAtual) cameraRef.current = { zoom: mapaAtual.getZoom(), pitch: mapaAtual.getPitch() }
  }
  followUserRef.current = followUser

  /**
   * Descobre UMA vez se os sprites de alta fidelidade foram entregues.
   *
   * Sem eles o marcador continua sendo o SVG — o app funciona igual, e
   * adicionar os PNGs depois não exige tocar em código. `spriteTick` só serve
   * para forçar um redesenho do marcador quando a resposta chega.
   */
  const [spriteTick, setSpriteTick] = useState(0)
  useEffect(() => {
    let cancelled = false
    // Refeito a cada troca de veículo: os oito ângulos do NOVO veículo
    // precisam ser verificados e pré-carregados antes de aparecerem.
    probeRiderSprites(vehicleModelId).then((found: boolean) => {
      if (found && !cancelled) setSpriteTick((value) => value + 1)
    })
    return () => {
      cancelled = true
    }
  }, [vehicleModelId])
  const routeGeometryRef = useRef(routeGeometry)
  routeGeometryRef.current = routeGeometry
  const onUserInteractionRef = useRef(onUserInteraction)
  onUserInteractionRef.current = onUserInteraction
  const onSelectRouteOptionRef = useRef(onSelectRouteOption)
  onSelectRouteOptionRef.current = onSelectRouteOption
  const themeRef = useRef(theme)
  themeRef.current = theme
  /** Lido dentro de callbacks que não podem depender do ciclo de render (setUpAppLayers, applyTheme). */
  const isNavigatingRef = useRef(isNavigating)
  isNavigatingRef.current = isNavigating

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: isMapConfigured ? env.mapStyleUrl : FALLBACK_DEMO_STYLE_URL,
      center: [SUPPORTED_REGION.center.lng, SUPPORTED_REGION.center.lat],
      zoom: SUPPORTED_REGION.initialZoom,
      attributionControl: { compact: true },
    })

    /*
      REDIMENSIONA O CANVAS QUANDO A ÁREA VISÍVEL MUDA.

      O MapLibre observa o CONTÊINER (ResizeObserver), o que resolve quase tudo
      — mas não o caso do iOS em modo de tela cheia: lá o contêiner pode manter
      o mesmo tamanho enquanto a área REALMENTE visível muda (barra do navegador
      recolhendo, indicador de gesto entrando). O observador não dispara, o
      canvas fica com a altura antiga, e sobra uma faixa da cor de fundo do app
      embaixo do mapa.

      `visualViewport` é a única API que enxerga essa mudança. O `resize` avulso
      depois da carga cobre o caso em que o layout se assenta um instante depois
      da inicialização — que é justamente quando o mapa já foi criado.
    */
    const ajustarCanvas = () => map.resize()
    const vv = window.visualViewport
    vv?.addEventListener('resize', ajustarCanvas)
    const assentar = setTimeout(ajustarCanvas, 600)

    // `originalEvent` só existe em eventos disparados por gesto real do usuário
    // (arrastar/pinçar) — chamadas programáticas (easeTo/fitBounds) não o têm,
    // então isso não interrompe o modo "seguir" quando é o próprio app movendo a câmera.
    const notifyUserInteraction = (e: { originalEvent?: unknown }) => {
      if (e.originalEvent) onUserInteractionRef.current?.()
    }
    map.on('dragstart', notifyUserInteraction)
    map.on('zoomstart', notifyUserInteraction)
    // Girar e inclinar com dois dedos também são interação manual. Sem estes,
    // o usuário conseguia rodar o mapa e o acompanhamento continuava ligado,
    // endireitando tudo no quadro seguinte.
    map.on('rotatestart', notifyUserInteraction)
    map.on('pitchstart', notifyUserInteraction)

    // Só dispara estado quando CRUZA o limiar — ver destinationCompact.
    const watchZoom = () => setDestinationCompact(map.getZoom() < DESTINATION_SIZES.compactBelowZoom)
    map.on('zoom', watchZoom)
    watchZoom()

    /**
     * Enquanto o dedo (ou o botão do mouse) está no mapa, a câmera automática
     * SAI DO CAMINHO — ver gestureActiveRef.
     *
     * O fim é ouvido na janela, não no container: soltar o dedo fora do mapa é
     * comum, e ouvir só no container deixaria a flag presa em true.
     */
    const container = map.getCanvasContainer()
    let wheelTimer: ReturnType<typeof setTimeout> | null = null

    const beginGesture = () => {
      gestureActiveRef.current = true
    }
    const endGesture = () => {
      gestureActiveRef.current = false
    }
    /**
     * A RODA não gera evento de ponteiro.
     *
     * Zoom por scroll é uma sequência de `wheel` sem começo nem fim
     * declarados, então a saída é uma janela curta que cada evento renova.
     * 220 ms cobre o intervalo entre eventos de um scroll contínuo e devolve
     * a câmera ao automático logo depois do último.
     */
    const onWheel = () => {
      gestureActiveRef.current = true
      if (wheelTimer) clearTimeout(wheelTimer)
      wheelTimer = setTimeout(() => {
        gestureActiveRef.current = false
      }, 220)
    }

    /**
     * As TRÊS famílias de evento, de propósito.
     *
     * O MapLibre trata gestos por `mousedown`/`touchstart`; o navegador
     * moderno emite `pointerdown` junto. Ouvir só uma família funciona no
     * aparelho, mas cria uma divergência silenciosa entre o que o MapLibre vê
     * e o que nós vemos — e foi exatamente aí que o primeiro teste desta
     * correção passou batido.
     */
    const inicios = ['pointerdown', 'mousedown', 'touchstart'] as const
    const fins = ['pointerup', 'pointercancel', 'mouseup', 'touchend', 'touchcancel'] as const
    for (const evento of inicios) container.addEventListener(evento, beginGesture, { passive: true })
    for (const evento of fins) window.addEventListener(evento, endGesture, { passive: true })
    container.addEventListener('wheel', onWheel, { passive: true })

    /**
     * As camadas do app são criadas quando o ESTILO fica pronto, não no evento
     * `load`.
     *
     * `load` só dispara quando o estilo E os primeiros tiles carregam. Com o
     * provedor de tiles limitando requisições (429 — observado em execução), o
     * evento nunca vinha e o app ficava SEM NENHUMA camada de rota: nem
     * traçado, nem trechos coloridos, nem marcadores. O mapa base não aparecer
     * é um problema de rede; a rota não aparecer por causa disso é um problema
     * nosso, e é o que este trecho conserta.
     *
     * `styledata` dispara mais de uma vez, daí a trava.
     */
    /*
      HANDLE DE DESENVOLVIMENTO.

      Só em `dev`, e existe por um motivo concreto: verificar uma camada do
      MapLibre (existe? com que expressão de cor? quantas feições?) é
      impossível de fora sem uma referência ao mapa, e o React não expõe
      nenhuma. Sem isto, a alternativa é conferir camada de mapa por
      screenshot, que não distingue "não pintou" de "pintou fraco".

      `import.meta.env.DEV` é apagado no build de produção, então nada disto
      chega ao usuário.
    */
    if (import.meta.env.DEV) {
      ;(window as unknown as { __gpsMap?: MapLibreMap }).__gpsMap = map
    }

    let layersReady = false
    const setUpAppLayers = () => {
      if (layersReady || !map.getStyle()) return
      layersReady = true
      // Pronto: para de escutar. `styledata` dispara a cada mudança de estilo
      // (recolorir, trocar ícone de POI, mexer em largura de via), e sem isto
      // este closure continuaria sendo chamado para não fazer nada pelo resto
      // da vida do mapa.
      map.off('styledata', setUpAppLayers)
      applyCartography(map, themeRef.current)
      refineCartography(map, themeRef.current)
      void applyPoiIcons(map, themeRef.current, { isNavigating: isNavigatingRef.current })
      /*
        A camada de adequação entra ANTES das camadas de rota, e é por isso que
        ela está aqui e não só no efeito reativo abaixo: ela se ancora no
        primeiro símbolo do estilo, e as camadas do app são adicionadas depois
        — a ordem resultante é malha colorida, rótulos do mapa, rota, marcador.
        Invertida, o realce cobriria o próprio traçado da rota.
      */
      applySuitabilityLayer(map, { enabled: suitabilityRef.current, vehicleModelId: vehicleRef.current })

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
        id: ROUTE_GLOW_OUTER_LAYER_ID,
        type: 'line',
        source: ROUTE_SEGMENTS_SOURCE_ID,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': severityGlowColor(themeRef.current),
          'line-width': routeGlowWidth('confirmed', 2.8),
          'line-opacity': 0.18,
          'line-blur': 10,
        },
      })
      map.addLayer({
        id: ROUTE_GLOW_INNER_LAYER_ID,
        type: 'line',
        source: ROUTE_SEGMENTS_SOURCE_ID,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': severityGlowColor(themeRef.current),
          'line-width': routeGlowWidth('confirmed', 1.75),
          'line-opacity': 0.28,
          'line-blur': 5,
        },
      })

      map.addLayer({
        id: ROUTE_CASING_LAYER_ID,
        type: 'line',
        source: ROUTE_SOURCE_ID,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': ribbon(themeRef.current).separator,
          'line-width': routeWidthExpression('confirmed', ROUTE_CASING_EXTRA_PX),
          'line-opacity': 0.85,
        },
      })
      map.addSource(ROUTE_APPROACH_SOURCE_ID, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({
        id: ROUTE_APPROACH_LAYER_ID,
        type: 'line',
        source: ROUTE_APPROACH_SOURCE_ID,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': ribbon(themeRef.current).core,
          'line-width': ['interpolate', ['linear'], ['zoom'], 14, 3, 17, 5, 20, 7],
          'line-opacity': 0.85,
          // Tracejado curto e espaçado: lê como "trecho não roteado" à
          // primeira vista, sem competir com a fita cheia da rota.
          'line-dasharray': [1.4, 1.6],
        },
      })

      // Contorno de profundidade, POR TRECHO. Entra entre o vinco e o miolo.
      map.addLayer({
        id: ROUTE_RIM_LAYER_ID,
        type: 'line',
        source: ROUTE_SEGMENTS_SOURCE_ID,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': severityRimColor(themeRef.current),
          'line-width': routeWidthExpression('confirmed', ROUTE_RIM_EXTRA_PX),
          'line-opacity': 1,
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
          // Opaco de verdade: a translucidez antiga deixava o asfalto vazar
          // por dentro do traçado, que é exatamente o efeito de "rota
          // integrada à rua" que o refinamento tinha que eliminar.
          'line-opacity': 1,
        },
      })
      // Brilho central.
      map.addLayer({
        id: ROUTE_SHEEN_LAYER_ID,
        type: 'line',
        source: ROUTE_SEGMENTS_SOURCE_ID,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': severitySheenColor(themeRef.current),
          'line-width': routeGlowWidth('confirmed', ROUTE_SHEEN_FACTOR),
          'line-opacity': 0.34,
          'line-blur': 1.5,
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
    }

    if (map.isStyleLoaded()) setUpAppLayers()
    else map.on('styledata', setUpAppLayers)

    mapRef.current = map
    return () => {
      map.off('zoom', watchZoom)
      for (const evento of fins) window.removeEventListener(evento, endGesture)
      if (wheelTimer) clearTimeout(wheelTimer)
      vv?.removeEventListener('resize', ajustarCanvas)
      clearTimeout(assentar)
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

  /**
   * ANEL DE ALCANCE do modo explorar.
   *
   * Fonte e camadas criadas sob demanda e removidas junto: o anel é um estado
   * momentâneo da interface, não parte permanente do mapa, e deixar camadas
   * vazias penduradas no estilo custa avaliação a cada quadro para desenhar
   * nada.
   */
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const remove = () => {
      for (const id of [RANGE_RING_LINE_LAYER_ID, RANGE_RING_FILL_LAYER_ID]) {
        if (map.getLayer(id)) map.removeLayer(id)
      }
      if (map.getSource(RANGE_RING_SOURCE_ID)) map.removeSource(RANGE_RING_SOURCE_ID)
    }

    if (rangeRingKm == null || rangeRingKm <= 0 || !userPoint) {
      remove()
      return
    }

    /*
      ESPERAR O ESTILO, em vez de desistir.

      BUG REAL, reproduzido: a primeira versão fazia `if (!map.isStyleLoaded())
      return` e o anel simplesmente nunca aparecia. O efeito rodava no instante
      em que o modo explorar abria — que costuma coincidir com carregamento de
      tiles —, encontrava o estilo ocupado, desistia, e não voltava mais: as
      dependências (`rangeRingKm`, `userPoint`) não mudam enquanto o usuário
      está parado olhando a tela, então não havia segunda chance.

      É a mesma armadilha que `setUpAppLayers` já documenta lá em cima. Aqui a
      saída é a mesma: agendar uma tentativa no próximo `styledata` e cancelá-la
      na limpeza.
    */
    const cancelWait = whenStyleReady(map, drawRing)
    return () => {
      cancelWait()
      remove()
    }

    function drawRing() {
      if (!map || rangeRingKm == null || !userPoint) return
      const data = circlePolygon(userPoint, rangeRingKm)
      const existing = map.getSource(RANGE_RING_SOURCE_ID)
      if (existing) {
        ;(existing as unknown as { setData: (value: unknown) => void }).setData(data)
        return
      }

      map.addSource(RANGE_RING_SOURCE_ID, { type: 'geojson', data } as never)
      // Preenchimento MUITO fraco: ele delimita, não colore. A área dentro do
      // anel é onde o usuário vai olhar o mapa de verdade — tingi-la
      // atrapalharia exatamente o que o anel existe para ajudar.
      map.addLayer({
        id: RANGE_RING_FILL_LAYER_ID,
        type: 'fill',
        source: RANGE_RING_SOURCE_ID,
        paint: { 'fill-color': ACCENT.go, 'fill-opacity': 0.07 },
      })
      map.addLayer({
        id: RANGE_RING_LINE_LAYER_ID,
        type: 'line',
        source: RANGE_RING_SOURCE_ID,
        paint: { 'line-color': ACCENT.go, 'line-width': 2, 'line-opacity': 0.75, 'line-dasharray': [3, 2] },
      })

      /*
        ENQUADRA O ANEL — e só na CRIAÇÃO, nunca nas atualizações.

        Um anel de 9 km desenhado num mapa em zoom de rua fica inteiramente fora
        da tela: o modo abriria dizendo "você alcança 9 km" sem mostrar nada. E
        enquadrar a cada atualização (a posição chega a 1 Hz) sequestraria a
        câmera do usuário toda vez que ele arrastasse o mapa.

        O `padding` inferior é grande porque a folha do modo ocupa a parte de
        baixo da tela — sem ele, o enquadramento centraliza o anel atrás da
        folha, que é o mesmo que não enquadrar.
      */
      const [[oesteLng, sulLat], [lesteLng, norteLat]] = boundsOf(data)
      map.fitBounds(
        [
          [oesteLng, sulLat],
          [lesteLng, norteLat],
        ],
        { padding: { top: 90, bottom: 380, left: 40, right: 40 }, duration: 700 },
      )
    }
  }, [rangeRingKm, userPoint])

  /**
   * Liga/desliga a camada de adequação e a reescreve ao trocar de veículo.
   *
   * Depende dos DOIS: a mesma via tem níveis diferentes para patinete e para
   * scooter, então trocar de veículo com a camada ligada precisa repintar a
   * cidade inteira — é justamente essa diferença que a camada existe para
   * mostrar.
   */
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    // Mesma razão do anel de alcance: desistir por estilo ocupado deixaria o
    // botão de camadas sem efeito, sem nenhuma segunda tentativa.
    return whenStyleReady(map, () => applySuitabilityLayer(map, { enabled: suitabilityLayer, vehicleModelId }))
  }, [suitabilityLayer, vehicleModelId])

  // Repinta o mapa quando o tema muda — sem isso, trocar de tema deixava a
  // interface clara sobre um mapa escuro (e vice-versa).
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const applyTheme = () => {
      applyCartography(map, theme)
      refineCartography(map, theme)
      void applyPoiIcons(map, theme, { isNavigating: isNavigatingRef.current })

      // As camadas de rota do app também trocam de paleta: os tons do tema
      // escuro (ciano/verde vivos) perdem contraste sobre um mapa claro.
      const repaint = (layerId: string, color: unknown) => {
        if (map.getLayer(layerId)) map.setPaintProperty(layerId, 'line-color', color)
      }
      const skin = ribbon(theme)
      repaint(ROUTE_GLOW_OUTER_LAYER_ID, severityGlowColor(theme))
      repaint(ROUTE_GLOW_INNER_LAYER_ID, severityGlowColor(theme))
      repaint(ROUTE_CASING_LAYER_ID, skin.separator)
      repaint(ROUTE_RIM_LAYER_ID, severityRimColor(theme))
      repaint(ROUTE_SHEEN_LAYER_ID, severitySheenColor(theme))
      repaint(ROUTE_APPROACH_LAYER_ID, skin.core)
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

  /**
   * Hierarquia dos POIs durante a NAVEGAÇÃO.
   *
   * O pacote de POIs é explícito: em navegação ativa os badges viram pontos de
   * 14px e os rótulos somem, porque a rota e a próxima manobra têm prioridade
   * absoluta. Efeito próprio, e não dentro do de tema, porque começar a
   * navegar não troca o tema — e antes disso os POIs continuariam em tamanho
   * de exploração por cima do traçado.
   */
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (map.isStyleLoaded()) {
      void applyPoiIcons(map, themeRef.current, { isNavigating })
      return
    }
    const run = () => void applyPoiIcons(map, themeRef.current, { isNavigating })
    map.once('idle', run)
    return () => {
      map.off('idle', run)
    }
  }, [isNavigating])

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

    const skin = ribbon(themeRef.current)

    /**
     * Intensidade do halo por estado.
     *
     * O halo era ZERO fora da navegação, para as candidatas não virarem um
     * borrão único na tela de seleção. Continua valendo — mas o caso do meio
     * (rota já confirmada, nenhuma candidata na tela) não tinha por que ficar
     * sem brilho nenhum: ali existe UM traçado, e o halo é justamente o que
     * separa a fita do mapa. Então o brilho é cheio na navegação, pela metade
     * na rota confirmada sozinha, e desligado enquanto houver alternativas ou
     * preview.
     */
    const glowScale = isNavigating ? 1 : showingOptions || isRoutePreview ? 0 : 0.5

    for (const [id, factor, opacity] of [
      [ROUTE_GLOW_OUTER_LAYER_ID, 2.8, 0.18],
      [ROUTE_GLOW_INNER_LAYER_ID, 1.75, 0.28],
    ] as const) {
      if (!map.getLayer(id)) continue
      map.setPaintProperty(id, 'line-width', routeGlowWidth(weight, factor))
      map.setPaintProperty(id, 'line-opacity', opacity * glowScale)
      map.setPaintProperty(id, 'line-color', severityGlowColor(themeRef.current))
    }

    map.setPaintProperty(ROUTE_LAYER_ID, 'line-width', routeWidthExpression(weight))
    map.setPaintProperty(ROUTE_LAYER_ID, 'line-opacity', 1)
    if (map.getLayer(ROUTE_RIM_LAYER_ID)) {
      map.setPaintProperty(ROUTE_RIM_LAYER_ID, 'line-width', routeWidthExpression(weight, ROUTE_RIM_EXTRA_PX))
    }
    if (map.getLayer(ROUTE_SHEEN_LAYER_ID)) {
      map.setPaintProperty(ROUTE_SHEEN_LAYER_ID, 'line-width', routeGlowWidth(weight, ROUTE_SHEEN_FACTOR))
      // No preview a fita é mais fina; o brilho central ali só suja o traço.
      map.setPaintProperty(ROUTE_SHEEN_LAYER_ID, 'line-opacity', weight === 'preview' ? 0.2 : 0.34)
    }
    if (map.getLayer(ROUTE_CASING_LAYER_ID)) {
      map.setPaintProperty(ROUTE_CASING_LAYER_ID, 'line-width', routeWidthExpression(weight, ROUTE_CASING_EXTRA_PX))
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
  }, [isRoutePreview, isNavigating, showingOptions])

  // Alterna visibilidade entre a camada de rota única (navegação) e a de
  // múltiplas candidatas (seleção) — nunca as duas ao mesmo tempo.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getLayer(ROUTE_LAYER_ID)) return
    const setVisibility = (layerId: string, visible: boolean) => {
      // Uma camada ausente (falha ao criar, estilo recarregado) não pode derrubar
      // o efeito e levar junto a visibilidade das outras.
      if (!map.getLayer(layerId)) return
      map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none')
    }
    // A rota ATIVA aparece sempre, pela camada segmentada — é ela que carrega
    // as cores por trecho. As candidatas convivem com ela, desenhadas por
    // baixo e sem incluir a ativa (ver routeOptions em App.tsx).
    setVisibility(ROUTE_LAYER_ID, true)
    setVisibility(ROUTE_CASING_LAYER_ID, true)
    setVisibility(ROUTE_RIM_LAYER_ID, true)
    setVisibility(ROUTE_SHEEN_LAYER_ID, true)
    setVisibility(ROUTE_OPTIONS_LAYER_ID, showingOptions)
    setVisibility(ROUTE_OPTIONS_DASHED_LAYER_ID, showingOptions)
    setVisibility(ROUTE_OPTIONS_HIT_LAYER_ID, showingOptions)
  }, [showingOptions])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const source = map.getSource(ROUTE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined
    if (!source || routeOptions.length > 0) return

    // Emendado ao destino: sem isto o traçado para no ponto da via e o pino
    // fica solto ao lado dele (ver joinToDestination).
    const coordinates: [number, number][] = joinToDestination(routeGeometry ?? [], destinationPoint).map(
      (point) => [point.lng, point.lat],
    )

    // O casing continua sendo UMA linha contínua: quebrado por trecho, ele
    // deixaria emendas visíveis em cada junção.
    source.setData({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates },
    })


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

  /**
   * TRECHOS COLORIDOS da rota ativa.
   *
   * Efeito PRÓPRIO, e isso é o conserto de dois bugs que juntos faziam os
   * trechos não recomendados nunca aparecerem no mapa:
   *
   * 1. Este `setData` vivia dentro do efeito da rota única, que começa com
   *    `if (routeOptions.length > 0) return`. Na tela de ESCOLHA de rota há
   *    candidatas, então o efeito saía cedo e a fonte segmentada nunca era
   *    preenchida — os trechos só poderiam aparecer durante a navegação.
   * 2. As dependências eram `[routeGeometry, routeOptions.length]`. Quando a
   *    classificação chega depois (ver enrichRouteResult), a GEOMETRIA não
   *    muda — só os segmentos —, então o efeito não re-rodava e a cor nunca
   *    era aplicada.
   */
  useEffect(() => {
    const map = mapRef.current
    const segmentSource = map?.getSource(ROUTE_SEGMENTS_SOURCE_ID) as maplibregl.GeoJSONSource | undefined
    if (!map || !segmentSource) return

    const usable = routeSeveritySegments.filter((segment) => segment.path.length >= 2)
    const fallback: [number, number][] = joinToDestination(routeGeometry ?? [], destinationPoint).map(
      (point) => [point.lng, point.lat],
    )

    segmentSource.setData({
      type: 'FeatureCollection',
      // Sem classificação por trecho (ainda chegando, ou provedor sem
      // resposta), desenha a rota inteira como adequada em vez de deixar o
      // mapa sem traçado — "adequada" aqui é ausência de dado, e é por isso
      // que o painel diz explicitamente que a classificação não está
      // disponível em vez de a cor afirmar sozinha.
      features: usable.length
        ? usable.map((segment, index) => ({
            type: 'Feature' as const,
            properties: { severity: segment.severity },
            geometry: {
              type: 'LineString' as const,
              // Só o ÚLTIMO trecho é emendado: emendar todos ligaria o fim de
              // cada um ao destino, desenhando um leque de linhas até o pino.
              coordinates: (index === usable.length - 1
                ? joinToDestination(segment.path, destinationPoint)
                : segment.path
              ).map((point) => [point.lng, point.lat]),
            },
          }))
        : fallback.length >= 2
          ? [
              {
                type: 'Feature' as const,
                properties: { severity: 'suitable' },
                geometry: { type: 'LineString' as const, coordinates: fallback },
              },
            ]
          : [],
    })
  }, [routeSeveritySegments, routeGeometry])

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

  /**
   * Conjunto do destino. Efeito PRÓPRIO, dependendo TAMBÉM da geometria.
   *
   * A rota chega depois do destino (o usuário escolhe o lugar, o traçado vem
   * segundos depois). Com dependência só em `destinationPoint`, a tampa de
   * chegada ficaria posicionada com a informação de antes da rota existir — e
   * quando a rota terminasse longe do ponto, a tampa continuaria sobre o
   * destino, sem linha nenhuma embaixo dela.
   */
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const arrival = arrivalPointFor(routeGeometry ?? [], destinationPoint)
    updateDestination(destinationMarkerRef, arrivalCapRef, map, destinationPoint, arrival, {
      compact: destinationCompact,
      // "Em foco" é o destino escolhido antes de a navegação começar — o
      // momento em que o usuário está decidindo se vai. Durante a navegação o
      // halo pulsante disputaria atenção com o marcador do veículo, que é o
      // elemento que precisa dela.
      focused: !isNavigating,
    })

    const approach = map.getSource(ROUTE_APPROACH_SOURCE_ID) as maplibregl.GeoJSONSource | undefined
    if (approach) {
      // Só existe quando o fim da rota NÃO é o destino — ou seja, quando a
      // emenda foi recusada por distância (ver joinToDestination).
      const needsApproach =
        destinationPoint != null &&
        arrival != null &&
        (arrival.lng !== destinationPoint.lng || arrival.lat !== destinationPoint.lat)
      approach.setData({
        type: 'FeatureCollection',
        features: needsApproach
          ? [
              {
                type: 'Feature' as const,
                properties: {},
                geometry: {
                  type: 'LineString' as const,
                  coordinates: [
                    [arrival.lng, arrival.lat],
                    [destinationPoint.lng, destinationPoint.lat],
                  ],
                },
              },
            ]
          : [],
      })
    }
  }, [destinationPoint, routeGeometry, destinationCompact, isNavigating])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

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

  /**
   * ENTRADA: cada amostra de GPS vira um alvo para o interpolador.
   *
   * Só registra o alvo. Quem desenha é o laço de quadro abaixo — separar as
   * duas coisas é o que permite o marcador continuar deslizando entre
   * amostras em vez de esperar a próxima para se mexer.
   */
  useEffect(() => {
    const rider = riderRef.current
    if (!rider) return
    if (!userPoint) {
      rider.reset()
      return
    }
    rider.push({ lng: userPoint.lng, lat: userPoint.lat, headingDeg })
  }, [userPoint, headingDeg])

  /**
   * SAÍDA: um laço de quadro move marcador e câmera juntos.
   *
   * A câmera usa `jumpTo`, não `easeTo`. Isso parece contraintuitivo, mas é o
   * que produz movimento suave aqui: a suavidade vem da interpolação, que já
   * roda a 60 Hz, e `easeTo` só acrescentaria uma SEGUNDA animação por cima —
   * era o encadeamento dessas animações de 1100 ms, cada uma cancelando a
   * anterior no meio, que deixava a câmera atrás do marcador nas curvas.
   *
   * As dependências são deliberadamente mínimas: recriar o laço interrompe a
   * interpolação em curso.
   */
  useEffect(() => {
    const map = mapRef.current
    const rider = riderRef.current
    if (!map || !rider) return

    if (!userPoint) {
      userMarkerRef.current?.remove()
      userMarkerRef.current = null
      cameraRef.current = { zoom: null, pitch: 0 }
      return
    }

    const draw = (frame: RiderFrame) => {
      updateUserMarker(
        userMarkerRef,
        map,
        { lng: frame.lng, lat: frame.lat },
        frame.headingDeg,
        isNavigatingRef.current,
        vehicleRef.current,
      )

      /**
       * Gesto em andamento: o marcador continua andando, a CÂMERA não é
       * tocada. É esta linha que devolve o mapa ao usuário durante a
       * navegação — sem ela, o `jumpTo` do quadro seguinte desfazia o
       * arrasto antes de o MapLibre reconhecê-lo como gesto.
       *
       * Não desliga o acompanhamento por conta própria: quem faz isso é o
       * `dragstart`/`rotatestart` do MapLibre, que agora consegue disparar.
       * Um toque simples, sem arrastar, não deve tirar o mapa do modo
       * automático — e não tira.
       */
      if (!followUserRef.current || gestureActiveRef.current) return

      const targetZoom = navigationZoomForSpeed(speedKmhRef.current, navigationZoomRef.current)
      navigationZoomRef.current = targetZoom

      // Zoom e inclinação perseguem o alvo em vez de saltar. Sem isto, entrar
      // na navegação inclinaria o mapa de 0° para 52° num único quadro, e
      // trocar de faixa de velocidade daria um solavanco de zoom.
      const camera = cameraRef.current
      camera.zoom = camera.zoom == null ? targetZoom : camera.zoom + (targetZoom - camera.zoom) * CAMERA_CHASE
      camera.pitch = camera.pitch + (NAVIGATION_PITCH - camera.pitch) * CAMERA_CHASE

      map.jumpTo({
        center: [frame.lng, frame.lat],
        zoom: camera.zoom,
        pitch: camera.pitch,
        padding: NAVIGATION_PADDING,
        // Sem rumo conhecido, mantém o ângulo atual em vez de forçar o norte —
        // evita o mapa "pular" de volta toda vez que o GPS perde a direção.
        bearing: frame.headingDeg ?? map.getBearing(),
      })
    }

    rider.start(draw)
    return () => rider.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPoint == null, spriteTick])

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
    /**
     * Só reporta quando o rumo muda de fato.
     *
     * A câmera da navegação é reposicionada por quadro, e cada
     * reposicionamento dispara `rotate`. Sem este filtro seriam 60 atualizações
     * de estado por segundo no React, re-renderizando o app inteiro para girar
     * uma agulha que muda meio grau. 1° é a resolução visível da bússola.
     */
    let lastReported: number | null = null
    const report = () => {
      const bearing = map.getBearing()
      if (lastReported != null && Math.abs(((bearing - lastReported + 540) % 360) - 180) < 1) return
      lastReported = bearing
      onBearingChange(bearing)
    }
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

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />

      {/*
        ATMOSFERA. A referência tem profundidade de campo e vinheta — as bordas
        escurecem e desfocam, e o olho vai para o centro. O MapLibre não tem
        pós-processamento (sem blur, sem bloom), mas o ESCURECIMENTO das bordas
        é só uma sobreposição, e é ele que carrega a maior parte da sensação.
        O desfoque não dá para reproduzir; a vinheta dá.

        `pointer-events-none` é obrigatório aqui: sem isso a camada engoliria
        todo arrasto, toque e pinça do mapa.

        Na navegação a vinheta é mais forte — o chrome é escuro e a imersão é o
        objetivo declarado; fora dela fica sutil, para não sujar a leitura da
        cartografia enquanto o usuário explora.
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-slow ease-out"
        style={{
          background: isNavigating
            ? 'radial-gradient(120% 85% at 50% 62%, rgba(6,10,20,0) 38%, rgba(6,10,20,.34) 76%, rgba(6,10,20,.62) 100%)'
            : 'radial-gradient(120% 90% at 50% 50%, rgba(10,14,26,0) 55%, rgba(10,14,26,.10) 82%, rgba(10,14,26,.22) 100%)',
        }}
      />
    </div>
  )
}

/**
 * Conjunto do DESTINO: tampa de chegada + pino.
 *
 * A tampa é adicionada ao mapa ANTES do pino, e marcador do MapLibre respeita
 * a ordem de inserção no DOM — então a tampa fica sob o pino e sobre a rota.
 * As duas âncoras caem no MESMO ponto (a tampa no centro, o pino na ponta
 * inferior), então o pino "nasce" da chegada em vez de flutuar ao lado dela.
 *
 * O pino não gira, não muda de cor por categoria e não é substituído por um
 * POI — se o destino também for um POI conhecido, o POI continua desenhado
 * pela camada do mapa, atrás.
 */
function updateDestination(
  markerRef: React.MutableRefObject<Marker | null>,
  capRef: React.MutableRefObject<Marker | null>,
  map: MapLibreMap,
  point: LngLat | null,
  /** Onde o traçado termina. Igual ao destino quando a rota o alcança. */
  arrivalPoint: LngLat | null,
  options: { compact: boolean; focused: boolean },
) {
  if (!point) {
    capRef.current?.remove()
    capRef.current = null
    markerRef.current?.remove()
    markerRef.current = null
    return
  }

  // A tampa é criada e adicionada PRIMEIRO: marcador do MapLibre respeita a
  // ordem de inserção no DOM, então ela fica sob o pino e sobre a rota.
  if (!capRef.current) {
    const cap = document.createElement('div')
    cap.className = 'pointer-events-none'
    cap.style.width = `${DESTINATION_SIZES.routeCapPx}px`
    cap.style.height = `${DESTINATION_SIZES.routeCapPx}px`
    cap.innerHTML = `<img src="${DESTINATION_ASSETS.routeCap}" alt="" aria-hidden="true" draggable="false" class="h-full w-full select-none" />`
    capRef.current = new maplibregl.Marker({ element: cap, anchor: 'center' })
  }
  const cap = arrivalPoint ?? point
  capRef.current.setLngLat([cap.lng, cap.lat])
  if (!capRef.current.getElement().isConnected) capRef.current.addTo(map)

  /**
   * TRÊS VARIANTES do marcador, cada uma com âncora própria:
   *
   * - `dot` em zoom baixo: um pino de 56px num enquadramento de cidade cobre
   *   quarteirões inteiros e deixa de apontar um lugar;
   * - `active` quando o destino está em foco: halo e anel pulsante, o estado
   *   que o pacote desenhou para "escolhi este lugar, estou decidindo";
   * - `marker` durante a navegação: sem halo, para não disputar atenção com o
   *   marcador do veículo.
   *
   * A troca RECRIA o marcador porque a âncora muda entre elas — o pino ancora
   * na ponta, o ativo na base do halo, o ponto no centro. `dataset.variant`
   * guarda qual está montado para não recriar a cada atualização.
   */
  const variant: 'dot' | 'active' | 'marker' = options.compact ? 'dot' : options.focused ? 'active' : 'marker'

  if (markerRef.current && markerRef.current.getElement().dataset.variant !== variant) {
    markerRef.current.remove()
    markerRef.current = null
  }

  if (!markerRef.current) {
    const element = document.createElement('div')
    element.className = 'pointer-events-none'
    element.dataset.variant = variant

    let src: string
    let width: number
    let ratio: number
    let anchor: 'bottom' | 'center'

    if (variant === 'dot') {
      src = DESTINATION_ASSETS.dot
      width = DESTINATION_SIZES.dotPx
      ratio = 1 // 40×40
      anchor = 'center'
    } else if (variant === 'active') {
      src = DESTINATION_ASSETS.markerActive
      // O arquivo ativo é 200×200 e o pino dentro dele ocupa cerca de um terço
      // da largura; para o PINO sair no mesmo tamanho da variante normal, o
      // elemento inteiro precisa ser proporcionalmente maior.
      width = Math.round(DESTINATION_SIZES.markerPx * 2.6)
      ratio = 1
      // Âncora na base do halo (70% da altura), conforme o pacote.
      anchor = 'center'
    } else {
      src = DESTINATION_ASSETS.marker
      width = DESTINATION_SIZES.markerPx
      ratio = 100 / 96 // arquivo 96×100
      anchor = 'bottom'
    }

    element.style.width = `${width}px`
    element.style.height = `${Math.round(width * ratio)}px`
    element.innerHTML = `<img src="${src}" alt="" aria-hidden="true" draggable="false" class="h-full w-full select-none" />`

    markerRef.current = new maplibregl.Marker({
      element,
      anchor,
      // A variante ativa é quadrada com o pino no meio-alto: o deslocamento
      // leva a PONTA do pino até a coordenada, como nas outras duas.
      offset: variant === 'active' ? [0, -Math.round(width * 0.2)] : [0, 0],
    })
  }

  markerRef.current.setLngLat([point.lng, point.lat])
  if (!markerRef.current.getElement().isConnected) markerRef.current.addTo(map)
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

  ref.current.setLngLat([point.lng, point.lat])
  // `addTo` NÃO é idempotente: ele remove o elemento do DOM e o reinsere. Como
  // isto agora roda a cada quadro, chamá-lo sempre significaria 60
  // remoções/inserções por segundo — e reiniciaria a transição CSS do cone a
  // cada quadro, congelando a animação dele no primeiro instante.
  if (!ref.current.getElement().isConnected) ref.current.addTo(map)
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
  isNavigating: boolean,
  vehicle: VehicleModelId,
) {
  if (!point) {
    ref.current?.remove()
    ref.current = null
    return
  }

  /**
   * O sprite do veículo aparece SEMPRE que os assets existem — o puck 2D é
   * fallback só para quando eles não foram publicados.
   *
   * Sem rumo conhecido o veículo é desenhado a 0°, que no pacote é a vista de
   * FRENTE. Isso não afirma direção: é a apresentação em repouso, como um
   * veículo parado de frente para quem olha. O que some sem rumo é o CONE, que
   * é o elemento que aponta para algum lado — e esse sim seria mentira.
   */
  const useSprite = hasRiderSprites(vehicle)
  const variant = useSprite ? `sprite:${vehicle}` : 'puck'

  if (ref.current && ref.current.getElement().dataset.variant !== variant) {
    ref.current.remove()
    ref.current = null
  }

  if (!ref.current) {
    const element = useSprite ? createVehicleSpriteElement(isNavigating) : createFallbackPuckElement()
    element.dataset.variant = variant
    ref.current = new maplibregl.Marker({
      element,
      // Ancorado no PONTO DE CONTATO do pneu com o chão (68% da altura da
      // imagem), não no centro: ancorar no centro faria o veículo flutuar
      // acima da via.
      anchor: 'center',
      offset: useSprite ? [0, spriteAnchorOffsetPx(isNavigating)] : [0, 0],
      // O sprite é uma vista fixa e NÃO gira. O que gira é o halo e o cone,
      // por dentro do elemento (ver applySpriteHeading).
      rotationAlignment: 'viewport',
    })
  }

  ref.current.setLngLat([point.lng, point.lat]).addTo(map)

  if (useSprite) {
    /**
     * RUMO NA TELA, não rumo da bússola.
     *
     * O elemento do marcador é DOM com `rotationAlignment: 'viewport'`: ele
     * vive no referencial da tela, e a tela gira com a câmera. Passar o rumo
     * do mundo direto para ele fazia o veículo aparecer atravessado sempre que
     * a câmera não estava apontada para o norte — ou seja, durante toda a
     * navegação, que é justamente quando o mapa gira para a direção do
     * deslocamento. Numa reta rumo ao leste, o mapa girava 90° e o sprite
     * também: dois giros somados, e o veículo ficava de perfil sobre a via.
     *
     * Subtraindo o bearing da câmera, o resultado é o ângulo entre "para onde
     * vou" e "para onde a tela aponta". Em navegação isso é ~0 e o veículo
     * aparece de trás, alinhado com a rua. Com o mapa travado ao norte, é o
     * próprio rumo. Com o usuário girando o mapa com dois dedos, acompanha.
     */
    const screenHeading = headingDeg == null ? null : headingDeg - map.getBearing()
    applySpriteHeading(ref.current.getElement(), vehicle, screenHeading, isNavigating)
  }
}

/** Tamanho do sprite em tela. O pacote sugere 96–128px na navegação ativa. */
function spriteSizePx(isNavigating: boolean): number {
  return isNavigating ? 108 : 76
}

/**
 * Deslocamento vertical que move a âncora do centro para o ponto de contato.
 *
 * O MapLibre ancora no centro do elemento; o pacote quer y=68% da imagem. A
 * diferença é (0,68 − 0,5) da altura, aplicada para CIMA (offset negativo
 * sobe o elemento, deixando o ponto de contato sobre a coordenada).
 */
function spriteAnchorOffsetPx(isNavigating: boolean): number {
  return -(SPRITE_ANCHOR_Y - 0.5) * spriteSizePx(isNavigating)
}

/**
 * Elemento do sprite, montado na ordem de camadas do pacote:
 * halo → cone de direção → PNG do veículo.
 *
 * A sombra de contato NÃO é uma camada aqui: ela já vem embutida no render de
 * cada PNG, projetada em plano transparente. Sobrepor a SVG duplicaria.
 */
function createVehicleSpriteElement(isNavigating: boolean): HTMLElement {
  const size = spriteSizePx(isNavigating)
  const element = document.createElement('div')
  element.className = 'relative'
  element.style.width = `${size}px`
  element.style.height = `${size}px`
  element.innerHTML = `
    <img data-role="halo" src="${SHARED_ASSETS.halo}" alt="" aria-hidden="true"
         class="pointer-events-none absolute inset-0 h-full w-full select-none" draggable="false" />
    <img data-role="cone" src="${SHARED_ASSETS.directionCone}" alt="" aria-hidden="true"
         class="pointer-events-none absolute inset-0 h-full w-full select-none" draggable="false" />
    <img data-role="vehicle" alt="" aria-hidden="true"
         class="pointer-events-none absolute inset-0 h-full w-full select-none" draggable="false" />
  `
  return element
}

/** Puck 2D do pacote — usado sem rumo confiável ou quando os sprites não foram publicados. */
function createFallbackPuckElement(): HTMLElement {
  const element = document.createElement('div')
  element.className = 'relative h-[64px] w-[64px]'
  element.innerHTML = `
    <img src="${SHARED_ASSETS.fallbackPuck}" alt="" aria-hidden="true"
         class="pointer-events-none h-full w-full select-none" draggable="false" />
  `
  return element
}

/**
 * Aplica o rumo: troca o PNG pelo ângulo mais próximo e gira APENAS o cone.
 *
 * O PNG não gira nunca — é uma vista renderizada em perspectiva, e rotacioná-la
 * produziria o veículo tombando em vez de outro ângulo. O cone, por ser
 * simétrico e plano, gira continuamente e é ele que dá a leitura fina de
 * direção entre um sprite e o seguinte.
 */
function applySpriteHeading(
  element: HTMLElement,
  vehicle: VehicleModelId,
  screenHeadingDeg: number | null,
  isNavigating: boolean,
) {
  const vehicleImage = element.querySelector('[data-role="vehicle"]') as HTMLImageElement | null
  if (vehicleImage) {
    // Sem rumo, 0 na tela = veículo visto de trás, apontando para cima. É a
    // apresentação em repouso e não afirma direção nenhuma; o que some sem
    // rumo é o cone, abaixo.
    const url = riderSpriteUrl(vehicle, screenHeadingDeg ?? 0)
    if (vehicleImage.getAttribute('src') !== url) vehicleImage.setAttribute('src', url)
  }

  const cone = element.querySelector('[data-role="cone"]') as HTMLElement | null
  if (cone) {
    // O cone só aparece em navegação ativa E com rumo conhecido: ele é o
    // elemento que aponta, então sem rumo ele afirmaria uma direção inexistente.
    cone.style.opacity = isNavigating && screenHeadingDeg != null ? '1' : '0'
    // O cone é DOM como o sprite: mesmo referencial de tela, mesmo ângulo.
    cone.style.transform = `rotate(${screenHeadingDeg ?? 0}deg)`
    cone.style.transition = 'transform 240ms cubic-bezier(.4,0,.2,1)'
  }

  const halo = element.querySelector('[data-role="halo"]') as HTMLElement | null
  if (halo) halo.style.opacity = '1'

  const size = spriteSizePx(isNavigating)
  if (element.style.width !== `${size}px`) {
    element.style.width = `${size}px`
    element.style.height = `${size}px`
  }
  // Guarda o tamanho mínimo legível do pacote como documentação viva: abaixo
  // dele o veículo deixa de ser reconhecível e o puck 2D é o certo.
  void MIN_LEGIBLE_SPRITE_PX
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
/**
 * Refinamento cartográfico por CAMADA NOMEADA.
 *
 * A recoloração geral (applyCartography) trabalha por heurística no id, porque
 * precisa tolerar qualquer estilo compatível com MapLibre. Isto aqui é o
 * oposto: mira os ids exatos do estilo MapTiler `streets-v2` que usamos, que
 * foram enumerados do style.json real (90 camadas — "Minor road", "Major road",
 * "Highway", "Building 3D", e as respectivas "* outline").
 *
 * Por que os dois existem: a heurística garante que o mapa NUNCA fica feio se
 * o provedor mudar; esta camada dá o acabamento fino — largura por zoom,
 * contorno, volume dos prédios — que é o que aproxima a cartografia da
 * referência. Se um id sumir, o `setPaint`/`setLayout` falha em silêncio e o
 * mapa continua com a recoloração geral.
 */
/**
 * Vias cujo traço é engrossado no zoom de navegação. O ajuste é um FATOR sobre
 * a expressão original, nunca uma substituição.
 *
 * A primeira versão disto trocava as larguras por uma tabela própria e ficou
 * pior: o MapTiler define largura por `class` dentro de cada camada
 * (secondary, tertiary, minor, service, track…), e a tabela chapada jogava
 * toda essa hierarquia fora — no zoom de exploração as ruas viraram fios.
 * Multiplicar preserva a nuance que já existe e só aumenta a presença onde a
 * navegação acontece.
 */
const THICKENED_ROAD_LAYERS = [
  'Highway',
  'Highway outline',
  'Major road',
  'Major road outline',
  'Minor road',
  'Minor road outline',
]

/**
 * Expressões originais do provedor, guardadas na primeira passada.
 *
 * Sem este cache, cada troca de tema multiplicaria de novo sobre o resultado
 * já multiplicado e as vias cresceriam sem parar.
 */
const originalRoadWidths = new WeakMap<MapLibreMap, Map<string, unknown>>()

/**
 * Engrossa uma expressão de largura sem perder a nuance por classe de via.
 *
 * Não dá para simplesmente multiplicar: no MapLibre, uma expressão de `zoom`
 * só é válida no nível MAIS EXTERNO da propriedade. `['*', <interpolate zoom>,
 * <interpolate zoom>]` é rejeitado — e rejeitado em silêncio, sem exceção: a
 * propriedade simplesmente não muda. (Verificado no mapa em execução: a
 * chamada não lança e `getPaintProperty` devolve o valor antigo.)
 *
 * A saída é reconstruir a mesma interpolação de zoom, multiplicando cada
 * SAÍDA por uma constante. Aí não há zoom aninhado e o `match` por classe do
 * provedor (secondary, tertiary, minor, service…) segue intacto.
 *
 * Devolve null quando a expressão não tem o formato esperado — nesse caso a
 * largura original fica como está, que é o comportamento seguro.
 */
function scaleZoomInterpolate(expression: unknown): maplibregl.ExpressionSpecification | null {
  if (!Array.isArray(expression) || expression[0] !== 'interpolate') return null
  const zoomOperand = expression[2]
  if (!Array.isArray(zoomOperand) || zoomOperand[0] !== 'zoom') return null

  // 1× até o zoom de exploração (nada muda ali) e crescendo só a partir do
  // zoom em que se navega, que é onde a via precisa de presença.
  const factorAt = (zoom: number) => {
    if (zoom <= 14) return 1
    if (zoom >= 20) return 1.55
    return 1 + ((zoom - 14) * 0.55) / 6
  }

  const rebuilt: unknown[] = [expression[0], expression[1], expression[2]]
  for (let i = 3; i < expression.length; i += 2) {
    const stop = expression[i]
    const output = expression[i + 1]
    if (typeof stop !== 'number') return null
    rebuilt.push(stop, ['*', output, factorAt(stop)])
  }

  return rebuilt as maplibregl.ExpressionSpecification
}

function refineCartography(map: MapLibreMap, theme: 'dark' | 'light') {
  const C = theme === 'light' ? MAP_COLORS_LIGHT : MAP_COLORS

  const setPaint = (layerId: string, property: string, value: unknown) => {
    try {
      if (map.getLayer(layerId)) map.setPaintProperty(layerId, property, value as never)
    } catch {
      // Estilo do provedor mudou: a recoloração geral já cobriu esta camada.
    }
  }

  let cache = originalRoadWidths.get(map)
  if (!cache) {
    cache = new Map()
    originalRoadWidths.set(map, cache)
  }

  for (const layerId of THICKENED_ROAD_LAYERS) {
    if (!map.getLayer(layerId)) continue
    if (!cache.has(layerId)) {
      try {
        cache.set(layerId, map.getPaintProperty(layerId, 'line-width'))
      } catch {
        continue
      }
    }
    const original = cache.get(layerId)
    if (original == null) continue

    const scaled = scaleZoomInterpolate(original)
    if (scaled) setPaint(layerId, 'line-width', scaled)
  }

  // Contorno das vias na cor da paleta: é ele que separa duas ruas paralelas
  // e dá definição ao traçado sobre o terreno.
  for (const layerId of ['Highway outline', 'Major road outline', 'Minor road outline']) {
    setPaint(layerId, 'line-color', C.roadCasing)
  }

  // Prédios em volume. Sem sombras nem oclusão (o MapLibre 4 não tem nenhuma
  // das duas), o relevo vem do gradiente vertical embutido — a face de cima
  // clareia em relação à base — e da altura vinda do dado real.
  setPaint('Building 3D', 'fill-extrusion-vertical-gradient', true)
  setPaint('Building 3D', 'fill-extrusion-opacity', theme === 'light' ? 0.5 : 0.42)
  // Prédios altos ficam levemente mais claros: dá leitura de silhueta urbana
  // sem inventar iluminação que o renderizador não calcula.
  setPaint('Building 3D', 'fill-extrusion-color', [
    'interpolate',
    ['linear'],
    ['coalesce', ['get', 'render_height'], 0],
    0,
    C.building,
    60,
    theme === 'light' ? '#F2F5F9' : '#26374E',
  ])

  // Água e verde são os únicos pontos de cor do mapa — é o que evita o cinza
  // uniforme da referência virar um borrão sem hierarquia.
  setPaint('Water', 'fill-color', C.water)
  setPaint('River', 'line-color', C.water)
}

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
        setPaint(layer.id, 'fill-color', C.greenArea)
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
 * Polígono que aproxima um círculo geodésico de raio `radiusKm`.
 *
 * 72 vértices (5° cada): abaixo disso o anel mostra vértices visíveis no zoom
 * de cidade, e acima disso não muda nada na tela — só engorda o GeoJSON que é
 * reenviado para a GPU a cada movimento do usuário.
 *
 * A correção por `cos(lat)` na longitude é obrigatória: sem ela o "círculo"
 * sairia achatado em latitudes distantes do equador, e Goiânia está a 16° sul.
 */
function circlePolygon(center: LngLat, radiusKm: number) {
  const EARTH_KM = 6371
  const latRad = (center.lat * Math.PI) / 180
  const deltaLat = (radiusKm / EARTH_KM) * (180 / Math.PI)
  const deltaLng = deltaLat / Math.max(0.01, Math.cos(latRad))

  const ring: [number, number][] = []
  for (let i = 0; i <= 72; i += 1) {
    const angle = (i / 72) * Math.PI * 2
    ring.push([center.lng + deltaLng * Math.cos(angle), center.lat + deltaLat * Math.sin(angle)])
  }

  return {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'Polygon' as const, coordinates: [ring] },
  }
}

/**
 * Roda `action` assim que o estilo do mapa estiver utilizável — agora, se já
 * estiver; no próximo `styledata`, se não.
 *
 * O CRITÉRIO É `getStyle()`, NÃO `isStyleLoaded()`, e a diferença não é
 * cosmética — foi o que quebrou o anel de alcance na primeira tentativa.
 *
 * MEDIDO: neste app `isStyleLoaded()` fica false essencialmente o tempo todo.
 * Ele só volta a true quando NADA está pendente no estilo, e aqui sempre está:
 * a recoloração da cartografia, o registro das imagens de POI e as camadas de
 * rota mexem no estilo continuamente. Um efeito que espera por `isStyleLoaded()`
 * espera para sempre.
 *
 * `getStyle()` responde à pergunta que de fato importa para adicionar camada:
 * o estilo já foi PARSEADO? Adicionar fonte e camada não exige que os tiles
 * tenham chegado. É o mesmo critério que `setUpAppLayers` usa desde sempre —
 * este helper só o generaliza.
 *
 * Devolve a função de limpeza que cancela a espera.
 */
function whenStyleReady(map: MapLibreMap, action: () => void): () => void {
  if (map.getStyle()) {
    action()
    return () => {}
  }

  const retry = () => {
    if (!map.getStyle()) return
    map.off('styledata', retry)
    action()
  }
  map.on('styledata', retry)
  return () => map.off('styledata', retry)
}

/** Caixa envolvente de um polígono simples, no formato que `fitBounds` espera. */
function boundsOf(feature: ReturnType<typeof circlePolygon>): [[number, number], [number, number]] {
  const ring = feature.geometry.coordinates[0]
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  for (const [lng, lat] of ring) {
    if (lng < west) west = lng
    if (lng > east) east = lng
    if (lat < south) south = lat
    if (lat > north) north = lat
  }
  return [
    [west, south],
    [east, north],
  ]
}
