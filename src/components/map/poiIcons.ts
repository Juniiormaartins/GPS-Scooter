import type { ExpressionSpecification, Map as MapLibreMap } from 'maplibre-gl'

import {
  BADGE_FILE_PX,
  BADGE_MIN_ZOOM,
  badgeUrl,
  DOT_FILE_PX,
  dotUrl,
  POI_CATEGORIES,
  POI_CLASS_MAP,
  POI_FALLBACK,
  POI_LAYER_IDS,
  poiImageId,
  type PoiCategory,
} from '@/components/map/poiLibrary'

/**
 * Aplica a biblioteca de POIs do Claude Design às camadas de POI do MapTiler.
 *
 * DIVISÃO DE RESPONSABILIDADE: `poiLibrary.ts` diz QUAL asset cada classe usa;
 * este arquivo só rasteriza, registra e aponta as camadas. Corrigir uma
 * equivalência não passa por aqui.
 *
 * A TROCA É POR `class`, NÃO POR CAMADA. A versão anterior registrava um ícone
 * por camada semântica do estilo (Food, Shopping, Transport…) e apontava a
 * camada inteira para ele — o que forçava 12 desenhos a cobrir centenas de
 * classes: posto de gasolina, ponto de recarga, bicicletário e estacionamento
 * dividiam o mesmo ícone porque o estilo os agrupa todos em `Transport`. Agora
 * o `icon-image` é uma expressão sobre `['get','class']`, então cada feição
 * escolhe seu badge dentro da camada em que já estava. Nenhum POI é recriado,
 * nenhum muda de lugar, a fonte de dados continua sendo a do provedor e os
 * filtros/zoom/ranking das camadas ficam intactos.
 *
 * OS DOIS TEMAS USAM O MESMO ASSET. O pacote resolve legibilidade com anel
 * branco a 94% e sombra própria, não com cor de fundo — então não há versão
 * clara e versão escura, e os ícones são rasterizados UMA vez por sessão em
 * vez de a cada troca de tema (a versão anterior re-rasterizava 11 ícones a
 * cada troca).
 */

/**
 * DPR de rasterização.
 *
 * Os arquivos são SVG, então dá para rasterizar em qualquer resolução — mas o
 * MapLibre guarda tudo num atlas de textura, e resolução demais custa memória
 * de GPU sem ganho visível. 3 é o teto útil: acima disso nenhuma tela de
 * celular resolve a diferença.
 */
const MAX_RASTER_RATIO = 3

function rasterRatio(): number {
  return Math.min(Math.max(window.devicePixelRatio || 1, 2), MAX_RASTER_RATIO)
}

/**
 * Rasteriza um SVG num tamanho exato.
 *
 * O `width`/`height` do arquivo é reescrito antes de virar imagem. Sem isso o
 * navegador usa o tamanho intrínseco do SVG (96px no badge, 32px no dot) como
 * resolução do bitmap, e o ícone apareceria borrado em tela de alto DPI — o
 * `viewBox` continua o mesmo, então o desenho não distorce.
 */
async function rasterize(url: string, pixels: number): Promise<HTMLImageElement> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`POI asset ausente: ${url}`)
  const contentType = response.headers.get('content-type') ?? ''
  // Este app é uma SPA: o servidor de desenvolvimento e a Vercel reescrevem
  // caminho desconhecido para o index.html COM status 200. Sem checar o
  // content-type, um asset faltando viraria um `<img>` apontando para HTML.
  if (!contentType.includes('svg')) throw new Error(`POI asset não é SVG: ${url}`)

  const source = await response.text()
  const sized = source
    .replace(/\swidth="[^"]*"/, ` width="${pixels}"`)
    .replace(/\sheight="[^"]*"/, ` height="${pixels}"`)

  const image = new Image()
  image.decoding = 'sync'
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sized)}`
  await image.decode()
  return image
}

interface RasterizedIcon {
  image: HTMLImageElement
  pixelRatio: number
}

/**
 * Cache de rasterização, por sessão.
 *
 * Chaveado só pelo id da imagem porque nem a variante nem o tema mudam o
 * bitmap. Guarda a PROMESSA e não o resultado: se duas chamadas concorrentes
 * pedirem o mesmo ícone (montagem e troca de tema quase juntas), as duas
 * esperam a mesma rasterização em vez de disparar duas.
 */
const rasterCache = new Map<string, Promise<RasterizedIcon>>()

function loadIcon(category: PoiCategory, variant: 'badge' | 'dot'): Promise<RasterizedIcon> {
  const id = poiImageId(category, variant)
  const cached = rasterCache.get(id)
  if (cached) return cached

  const cssSize = variant === 'badge' ? BADGE_FILE_PX : DOT_FILE_PX
  const ratio = rasterRatio()
  const url = variant === 'badge' ? badgeUrl(category) : dotUrl(category)

  const promise = rasterize(url, Math.round(cssSize * ratio)).then((image) => ({ image, pixelRatio: ratio }))
  rasterCache.set(id, promise)
  return promise
}

/**
 * Expressão que escolhe o asset a partir da `class` da feição.
 *
 * Um único `match` com ~130 chaves em vez de um ícone por camada. O MapLibre
 * compila `match` numa tabela de busca, então o custo por feição é constante —
 * não é uma cadeia de comparações.
 *
 * Classe desconhecida ou ausente cai em `poi_generico`, nunca em ícone nenhum:
 * esconder o POI por falta de mapeamento seria perder informação real do
 * provedor por um detalhe nosso.
 */
function imageExpression(variant: 'badge' | 'dot'): ExpressionSpecification {
  const cases: string[] = []
  for (const [className, category] of Object.entries(POI_CLASS_MAP)) {
    cases.push(className, poiImageId(category, variant))
  }
  return [
    'match',
    ['coalesce', ['get', 'class'], ''],
    ...cases,
    poiImageId(POI_FALLBACK, variant),
  ] as unknown as ExpressionSpecification
}

/**
 * `icon-image` final: ponto no zoom baixo, badge a partir do zoom de rua.
 *
 * O pacote define o `dot` justamente para densidade alta — num zoom de bairro
 * os badges de 40px se sobreporiam e o MapLibre esconderia a maior parte
 * deles, o que dá um mapa que pisca POIs conforme se navega. Trocar a variante
 * mantém todos visíveis.
 */
function iconImageExpression(forceDot: boolean): ExpressionSpecification {
  if (forceDot) return imageExpression('dot')
  return [
    'step',
    ['zoom'],
    imageExpression('dot'),
    BADGE_MIN_ZOOM,
    imageExpression('badge'),
  ] as unknown as ExpressionSpecification
}

/**
 * `icon-size` acompanhando a troca de variante.
 *
 * Uma curva só, e não duas aninhadas: o MapLibre exige que `['zoom']` apareça
 * apenas no nível mais externo da expressão, então `step(zoom, interpolate(zoom
 * …))` é rejeitado.
 *
 * Os valores saem dos tamanhos de arquivo (ver poiLibrary): dot de 22px em
 * escala 1, badge de 40px em escala 1. O degrau entre 14,99 e 15 é o ponto em
 * que o ponto vira badge.
 */
function iconSizeExpression(forceDot: boolean): ExpressionSpecification {
  if (forceDot) {
    // Navegação: 14px fixos. A rota e a manobra têm prioridade absoluta.
    return 14 / 22 as unknown as ExpressionSpecification
  }
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    11,
    0.73, // ponto de 16px
    14.99,
    1, // ponto de 22px
    BADGE_MIN_ZOOM,
    0.78, // badge de 31px
    17,
    0.88, // badge de 35px
    19,
    1, // badge de 40px
  ] as unknown as ExpressionSpecification
}

/**
 * Posição do rótulo — à direita do BADGE, abaixo do PONTO.
 *
 * O pacote pede o nome à direita do badge, e faz sentido: o MapTiler o põe
 * abaixo com 0,8em de deslocamento, medida feita para o ícone de 14px dele, e
 * com um badge de 31–40px o nome encostaria na sombra.
 *
 * Mas só a partir do badge. No zoom de bairro o ícone é o ponto de 20px, e
 * rótulo à direita alarga muito o símbolo: como as camadas do estilo usam
 * `text-optional`, símbolo largo significa mais rótulo descartado por colisão
 * — exatamente onde há mais POIs. Abaixo do zoom de rua o rótulo volta para
 * baixo, que é a posição mais compacta.
 *
 * O deslocamento é em EM do texto, não em pixels.
 */
function textAnchorExpression(forceDot: boolean): ExpressionSpecification {
  if (forceDot) return 'top' as unknown as ExpressionSpecification
  return ['step', ['zoom'], 'top', BADGE_MIN_ZOOM, 'left'] as unknown as ExpressionSpecification
}

function textOffsetExpression(forceDot: boolean): ExpressionSpecification {
  if (forceDot) return ['literal', [0, 0.8]] as unknown as ExpressionSpecification
  return [
    'step',
    ['zoom'],
    ['literal', [0, 0.9]],
    BADGE_MIN_ZOOM,
    ['literal', [1.8, 0]],
  ] as unknown as ExpressionSpecification
}

/** Registro de imagens já colocadas em cada mapa — `addImage` lança se o id repetir. */
const registeredMaps = new WeakSet<MapLibreMap>()

/**
 * `text-field` original de cada camada, para poder devolver.
 *
 * Durante a navegação os rótulos somem, e sumir aqui é esvaziar o `text-field`
 * (não mexer em `text-opacity`, que carrega a expressão de ranking do
 * provedor — sobrescrevê-la destruiria o controle de densidade dele).
 */
const originalTextFields = new WeakMap<MapLibreMap, Map<string, unknown>>()

async function registerImages(map: MapLibreMap) {
  if (registeredMaps.has(map)) return
  registeredMaps.add(map)

  const jobs: Promise<void>[] = []
  for (const category of POI_CATEGORIES) {
    for (const variant of ['badge', 'dot'] as const) {
      jobs.push(
        loadIcon(category, variant)
          .then(({ image, pixelRatio }) => {
            const id = poiImageId(category, variant)
            if (map.hasImage(id)) return
            map.addImage(id, image, { pixelRatio })
          })
          .catch(() => {
            // Um asset ausente não pode derrubar os outros 39. A classe que
            // dependia dele fica sem imagem e o MapLibre desenha o rótulo sem
            // ícone, que é degradação aceitável.
          }),
      )
    }
  }
  await Promise.all(jobs)
}

/**
 * Ponto de entrada. Idempotente: chamada na montagem, na troca de tema e ao
 * entrar/sair da navegação.
 *
 * `theme` não é mais usado para escolher asset (o pacote é único para os dois
 * temas) — continua no parâmetro porque quem chama já o tem e porque uma
 * eventual versão por tema entraria aqui sem mudar as chamadas.
 */
export async function applyPoiIcons(
  map: MapLibreMap,
  _theme: 'dark' | 'light',
  options: { isNavigating?: boolean } = {},
) {
  const forceDot = options.isNavigating === true

  await registerImages(map)

  let snapshot = originalTextFields.get(map)
  if (!snapshot) {
    snapshot = new Map()
    originalTextFields.set(map, snapshot)
  }

  for (const layerId of POI_LAYER_IDS) {
    if (!map.getLayer(layerId)) continue

    try {
      if (!snapshot.has(layerId)) {
        snapshot.set(layerId, map.getLayoutProperty(layerId, 'text-field'))
      }

      map.setLayoutProperty(layerId, 'icon-image', iconImageExpression(forceDot))
      map.setLayoutProperty(layerId, 'icon-size', iconSizeExpression(forceDot))
      // Sem âncora explícita o badge quadrado herda o alinhamento pensado para
      // o ícone pequeno do provedor.
      map.setLayoutProperty(layerId, 'icon-anchor', 'center')
      // Folga entre símbolos. O padrão do estilo é 2, dimensionado para o
      // ícone de 14px do provedor: com badge de 31–40px os POIs vizinhos
      // encostariam. `text-padding` fica como o provedor deixou — a densidade
      // de rótulos é decisão dele, e sobrescrevê-la aqui só desligaria POIs
      // que ele considera relevantes.
      map.setLayoutProperty(layerId, 'icon-padding', forceDot ? 2 : 6)

      map.setLayoutProperty(layerId, 'text-anchor', textAnchorExpression(forceDot))
      map.setLayoutProperty(layerId, 'text-offset', textOffsetExpression(forceDot))
      map.setLayoutProperty(layerId, 'text-field', forceDot ? '' : snapshot.get(layerId))
    } catch {
      // Camada renomeada ou removida pelo provedor: as outras seguem válidas.
    }
  }
}
