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

  /** Candidatas simultâneas na tela de seleção de rota, por elegibilidade. */
  routeByEligibility: {
    allowed: ACCENT.go,
    discouraged: ACCENT.warn,
    'not-allowed': ACCENT.danger,
  },

  /** Marcador da posição do usuário. */
  puckFill: ACCENT.primary,
  puckHalo: 'rgba(53,183,247,.22)',
} as const
