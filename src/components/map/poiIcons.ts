import type { Map as MapLibreMap } from 'maplibre-gl'

/**
 * Ícones de POI por CATEGORIA.
 *
 * DE ONDE VINHAM OS ÍCONES ANTIGOS: os POIs chegam pela camada vetorial `poi`
 * do MapTiler, e o estilo `streets-v2` já os agrupa em camadas semânticas
 * (Food, Transport, Healthcare, Shopping, Culture, Education, Tourism, Sport,
 * Park, Station, Public). Cada camada resolve `icon-image` a partir do `class`
 * do POI contra o sprite do provedor, com `dot` como último recurso — e é esse
 * `dot` que aparecia repetido em metade dos estabelecimentos.
 *
 * O CONSERTO É POR CAMADA, NÃO POR ESTABELECIMENTO. Como o agrupamento
 * semântico já existe, basta registrar um ícone nosso por categoria e trocar o
 * `icon-image` daquela camada. Nenhum POI é recriado, nenhum desaparece, e a
 * fonte de dados continua sendo a do provedor.
 *
 * POR QUE RASTER E NÃO SDF: o MapLibre aceita `sdf: true` e permite tingir o
 * ícone por expressão, mas trata o canal alfa como campo de distância — em
 * formas finas de 14px o resultado fica borrado. Aqui as imagens são
 * rasterizadas com a cor já embutida e REGISTRADAS DE NOVO quando o tema muda,
 * o que mantém o traço nítido nos dois temas.
 */

/** Categoria → camadas do estilo MapTiler que ela cobre. */
const CATEGORY_LAYERS: Record<string, string[]> = {
  food: ['Food'],
  transport: ['Transport'],
  health: ['Healthcare'],
  shopping: ['Shopping'],
  culture: ['Culture'],
  education: ['Education'],
  tourism: ['Tourism'],
  sport: ['Sport'],
  park: ['Park'],
  station: ['Station'],
  public: ['Public'],
}

/**
 * Traços dos ícones, em grade de 24. Monoline de 2px, cantos redondos — a
 * mesma linguagem dos ícones da interface, para o mapa não parecer de outro
 * produto.
 */
const CATEGORY_PATHS: Record<string, string> = {
  // Talher: cobre restaurante, lanchonete, bar, café e sorveteria numa família só.
  food: 'M7 3v8a2 2 0 0 0 4 0V3M9 11v10M17 3c-1.6 1-2.4 2.7-2.4 5s.8 3.6 2.4 4v9',
  // Bomba de combustível — vale para posto e para ponto de recarga.
  transport: 'M4 20V5a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v15M3 20h12M6 9h5M16 8l3 3v6a1.5 1.5 0 0 0 3 0v-8l-2.5-2.5',
  // Cruz médica.
  health: 'M12 5v14M5 12h14',
  // Sacola de compras.
  shopping: 'M5 8h14l-1 12H6L5 8ZM9 8V6a3 3 0 0 1 6 0v2',
  // Colunas — museu, teatro, galeria.
  culture: 'M4 10h16M5 10v9M10 10v9M14 10v9M19 10v9M3 19h18M12 3l8 5H4l8-5Z',
  // Capelo.
  education: 'M2 8l10-4 10 4-10 4L2 8ZM6 10v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5',
  // Estrela — atração e hospedagem.
  tourism: 'M12 4l2.4 5.2 5.6.6-4.2 3.9 1.2 5.6L12 16.4 6.9 19.3l1.2-5.6L4 9.8l5.6-.6L12 4Z',
  // Halter.
  sport: 'M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10',
  // Árvore.
  park: 'M12 3l5 7h-3l4 6h-4v5h-4v-5H6l4-6H7l5-7Z',
  // Ônibus.
  station: 'M5 6h14v9H5zM5 15v3h3v-3M16 15v3h3v-3M5 10h14M8 12.5h.01M16 12.5h.01',
  // Marcador genérico, mas com forma própria — melhor que o ponto do provedor.
  public: 'M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11ZM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
}

/** Cores por tema. O ícone precisa ler sobre o terreno, não competir com a rota. */
const THEME_COLORS = {
  light: { stroke: '#5B6B85', halo: '#FFFFFF' },
  dark: { stroke: '#93A6C4', halo: '#0B111F' },
} as const

const ICON_PIXEL_SIZE = 44
const ICON_PIXEL_RATIO = 2

function iconId(category: string): string {
  return `gps-poi-${category}`
}

/**
 * Desenha o ícone num canvas.
 *
 * O halo por trás do traço é o que garante leitura sobre qualquer parte do
 * mapa — sobre uma via branca, sobre o terreno ou sobre uma área verde. Sem
 * ele, um traço fino de 2px some assim que o fundo tem a mesma luminosidade.
 */
async function renderIcon(path: string, theme: 'dark' | 'light'): Promise<HTMLImageElement> {
  const { stroke, halo } = THEME_COLORS[theme]
  const size = ICON_PIXEL_SIZE
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">
    <g fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="${path}" stroke="${halo}" stroke-width="5" stroke-opacity=".9"/>
      <path d="${path}" stroke="${stroke}" stroke-width="2"/>
    </g>
  </svg>`

  const image = new Image(size * ICON_PIXEL_RATIO, size * ICON_PIXEL_RATIO)
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  await image.decode()
  return image
}

/**
 * Registra (ou atualiza) os ícones e aponta cada camada de POI para o seu.
 *
 * Idempotente de propósito: é chamada na montagem e de novo a cada troca de
 * tema, e o MapLibre lança se `addImage` receber um id que já existe — daí a
 * distinção entre `addImage` e `updateImage`.
 *
 * Falha em silêncio por camada: se o provedor renomear ou remover uma delas, as
 * outras continuam válidas e os POIs daquela seguem com o ícone original.
 */
export async function applyPoiIcons(map: MapLibreMap, theme: 'dark' | 'light') {
  for (const [category, layers] of Object.entries(CATEGORY_LAYERS)) {
    const path = CATEGORY_PATHS[category]
    if (!path) continue

    try {
      const image = await renderIcon(path, theme)
      const id = iconId(category)
      if (map.hasImage(id)) map.updateImage(id, image)
      else map.addImage(id, image, { pixelRatio: ICON_PIXEL_RATIO })

      for (const layerId of layers) {
        if (!map.getLayer(layerId)) continue
        map.setLayoutProperty(layerId, 'icon-image', id)
        // Tamanho único em todas as categorias: é o que faz o conjunto ler
        // como uma família em vez de ícones avulsos de origens diferentes.
        map.setLayoutProperty(layerId, 'icon-size', [
          'interpolate',
          ['linear'],
          ['zoom'],
          13,
          0.42,
          16,
          0.55,
          19,
          0.7,
        ])
      }
    } catch {
      // Ícone não renderizou ou camada mudou de nome — o POI continua com o
      // ícone do provedor, que é degradação aceitável.
    }
  }
}
