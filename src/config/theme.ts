/**
 * Design tokens expostos como hex literais, para consumidores que não podem
 * usar classes Tailwind — hoje só o MapLibre GL (paint properties das camadas
 * do mapa e das rotas).
 *
 * Fonte da verdade: design/gps-scooter-ui/tokens/colors.css (handoff de
 * design). Os valores aqui e os de tailwind.config.js precisam continuar
 * batendo entre si e com aquele arquivo — se um mudar, mude os três.
 */

/** Acentos semânticos — cada um tem uma função fixa (ver README do handoff). */
export const ACCENT = {
  primary: '#35B7F7', // navegação, links, seleção, rota ativa
  go: '#2FD16A', // confirmar/iniciar, bateria, rota segura
  warn: '#F5A623', // locais salvos, rota alternativa
  danger: '#F04545', // destrutivo, via não recomendada
} as const

/**
 * Cartografia — aplicada ao estilo do mapa REAL do provedor (MapTiler), não a
 * um mapa desenhado. Ver MapView.tsx: as camadas do estilo são recoloridas em
 * tempo de execução com estes valores.
 *
 * Contraste verificado: fundo #0E1424 contra via principal #2B3A56 tem
 * diferença de luminosidade ~3x — legível de verdade, diferente do estilo
 * "dark" pronto do Mapbox que tínhamos antes (~1,5x, ilegível).
 */
/**
 * Cartografia do tema CLARO. Mesma lógica do escuro, invertida com cuidado:
 * as vias ficam BRANCAS sobre um fundo cinza-azulado (é assim que mapas
 * claros criam hierarquia), e as principais ganham um cinza levemente mais
 * quente para se destacarem das secundárias.
 */
export const MAP_COLORS_LIGHT = {
  /**
   * MEDIDO, não escolhido no olho. A versão anterior usava fundo #EEF1F7 com
   * vias #F7F9FD/#FFFFFF, o que dá razão de contraste de 1,07:1 entre rua e
   * fundo e 1,05:1 entre rua secundária e principal — ou seja, nenhuma
   * hierarquia e ruas praticamente invisíveis. Somado a isso, os prédios
   * ficavam MAIS escuros que as ruas, então a massa construída lia como
   * figura e a malha viária como fundo: exatamente o inverso do que um GPS
   * precisa. Escurecer o fundo é o que faz a rua branca aparecer.
   */
  background: '#D3DCEA',
  water: '#A8C6E0',
  /** Vias brancas: o elemento mais claro do mapa, por decisão. */
  roadMajor: '#FFFFFF',
  roadMinor: '#FFFFFF',
  /** Expressas/rodovias em âmbar — no nosso caso isso é informação, não enfeite: é o que o app recomenda evitar. */
  roadHighway: '#F5C87A',
  /** Contorno das vias. É ele que separa duas ruas paralelas e dá definição ao traçado. */
  roadCasing: '#A9B9D1',
  /** Prédios DELIBERADAMENTE discretos — quase o fundo. Eles não são a informação. */
  building: '#C6D1E2',
  rail: '#B4C1D4',
  /** Trilhas/calçadões em tom quente, para não serem confundidos com rua. */
  path: '#E0D3B8',
  poi: '#AFBDD2',
  label: '#2B3A52',

  /**
   * Rotas no tema claro: tons mais escuros/saturados que os do tema escuro.
   * O ciano #35B7F7 e o verde #2FD16A brilham sobre fundo escuro, mas perdem
   * contraste sobre um mapa claro — aqui usam as variantes 600 da paleta.
   */
  routeSelected: '#0E86C6',
  routeCasing: '#FFFFFF',
  routeByEligibility: {
    allowed: '#17A34A',
    discouraged: '#B3730A',
    'not-allowed': '#D92626',
  },
} as const

export const MAP_COLORS = {
  background: '#0B111F',
  /**
   * Água precisa diferir do fundo. Antes era EXATAMENTE a mesma cor (#0E1424),
   * então rio e lago liam como quarteirão vazio. O primeiro ajuste (#10263F)
   * ainda dava só 1,23:1; este dá ~1,9:1, na mesma faixa das vias — água é
   * referência de orientação, precisa ser reconhecível de relance.
   */
  water: '#17395E',
  roadMajor: '#4A5D82',
  /** Expressas/rodovias em âmbar apagado — mesma função informativa do tema claro. */
  roadHighway: '#7A6437',
  roadCasing: '#0B111F',
  building: '#131B2D',
  rail: '#2B3752',
  path: '#2F4038',
  /**
   * DESVIO CONSCIENTE do handoff, documentado: ele especifica #131C2E
   * (--ink-850) para vias secundárias, mas contra o fundo #0E1424 isso dá
   * razão de contraste ~1,07:1 — invisível. Como a maioria das ruas de
   * Goiânia é "via secundária", o mapa ficaria só com as duas artérias
   * principais visíveis (foi exatamente o sintoma relatado antes).
   * Subimos a rampa de novo depois de medir: com #212D45 o contraste com o
   * fundo era 1,35:1 e o degrau para a via principal, 1,20:1. Os valores
   * atuais dão 1,85:1 para o fundo e 1,52:1 entre secundária e principal —
   * na mesma faixa em que um GPS de referência opera, mantendo a paleta.
   */
  roadMinor: '#33425F',
  poi: '#3B4C6B',
  /**
   * Rótulos bem mais claros que antes (#8A9CB6). Nome de rua é lido de
   * relance, em movimento, muitas vezes sob sol — é o texto que menos pode
   * economizar contraste.
   */
  label: '#C6D5EA',

  /** Rota confirmada em navegação ativa. */
  routeLine: ACCENT.primary,
  /** Contorno sob a linha da rota — no tema escuro é o próprio fundo do mapa, não branco. */
  routeCasing: '#0E1424',

  /**
   * Candidatas simultâneas na tela de seleção.
   *
   * A rota SELECIONADA usa sempre o azul da marca (`routeSelected`), não a
   * cor da elegibilidade: azul é o token de "seleção/navegação" em todo o
   * app (botão ativo, aba ativa, marcador do usuário), então a linha
   * escolhida fica visualmente ligada aos marcadores de origem/destino e ao
   * resto da interface — o verde antes fazia a rota principal parecer
   * desconectada da identidade.
   *
   * As NÃO selecionadas mantêm a cor semântica, que é onde ela carrega
   * informação de verdade: dá para bater o olho e ver qual alternativa é
   * adequada (verde), com ressalva (âmbar) ou inadequada (vermelha).
   */
  routeSelected: ACCENT.primary,
  routeByEligibility: {
    allowed: ACCENT.go,
    discouraged: ACCENT.warn,
    'not-allowed': ACCENT.danger,
  },

  /** Marcador da posição do usuário. */
  puckFill: ACCENT.primary,
  puckHalo: 'rgba(53,183,247,.22)',
} as const
