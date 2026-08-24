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
  background: '#EEF1F7',
  water: '#D6E4F0',
  roadMajor: '#FFFFFF',
  roadMinor: '#F7F9FD',
  poi: '#C3CDDE',
  label: '#4A5A72',

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
  background: '#0E1424',
  water: '#0E1424',
  roadMajor: '#2B3A56', // --ink-600, exatamente como o handoff especifica
  /**
   * DESVIO CONSCIENTE do handoff, documentado: ele especifica #131C2E
   * (--ink-850) para vias secundárias, mas contra o fundo #0E1424 isso dá
   * razão de contraste ~1,07:1 — invisível. Como a maioria das ruas de
   * Goiânia é "via secundária", o mapa ficaria só com as duas artérias
   * principais visíveis (foi exatamente o sintoma relatado antes).
   * Subimos um degrau da mesma rampa (--ink-700), que mantém a hierarquia
   * (continua bem abaixo da via principal) mas fica legível.
   */
  roadMinor: '#212D45',
  poi: '#3B4C6B',
  label: '#8A9CB6',

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
