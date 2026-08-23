import colors from 'tailwindcss/colors.js'

/**
 * Fonte única de verdade da identidade visual do GPS Scooter (réplica do
 * protótipo Figma — modo escuro). Os apelidos semânticos abaixo apontam para
 * as MESMAS escalas usadas em tailwind.config.js (que também importa
 * 'tailwindcss/colors'), então não há risco de divergência entre as classes
 * Tailwind usadas nos componentes e os hex literais que este módulo expõe
 * para consumidores que não podem usar classes Tailwind (ex: paint
 * properties do MapLibre GL).
 *
 * Papéis:
 * - BRAND (ciano): marca, ação primária de busca/navegação, foco, links.
 * - SUCCESS (verde): rota recomendada/adequada, "ir", ligado.
 * - WARNING (âmbar): rota alternativa com ressalva.
 * - DANGER (vermelho): rota inadequada/rápida-mas-ruim, ação destrutiva.
 * - NAVY (slate): mantido como alias de texto/contraste sobre as superfícies escuras.
 */
export const BRAND = colors.sky
export const NAVY = colors.slate
export const SUCCESS = colors.green
export const WARNING = colors.amber
export const DANGER = colors.rose

/** Hex literais usados fora do Tailwind (paint properties do MapLibre GL). */
export const MAP_COLORS = {
  routeCasing: '#0A0E1A',
  /** Linha única (navegação ativa — uma rota já confirmada). */
  routeLine: BRAND[400],
  /** Linhas de múltiplas candidatas simultâneas na tela de seleção de rota, por elegibilidade. */
  routeByEligibility: {
    allowed: SUCCESS[400],
    discouraged: WARNING[400],
    'not-allowed': DANGER[400],
  },
} as const
