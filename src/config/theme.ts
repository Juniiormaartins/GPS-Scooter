import colors from 'tailwindcss/colors.js'

/**
 * Fonte única de verdade da identidade visual do GPS Scooter.
 * Os apelidos semânticos abaixo (BRAND/NAVY/SUCCESS) apontam para as MESMAS
 * escalas usadas em tailwind.config.js (que também importa 'tailwindcss/colors'),
 * então não há risco de divergência entre as classes Tailwind usadas nos
 * componentes e os hex literais que este módulo expõe para consumidores que
 * não podem usar classes Tailwind (ex: paint properties do MapLibre GL).
 *
 * Papéis:
 * - BRAND (azul): marca, navegação, rota, ação primária, estados ativos.
 * - NAVY (grafite/azul profundo): texto principal, superfícies escuras, contraste.
 * - SUCCESS (verde): reservado para significado semântico (ex: bateria saudável,
 *   rota adequada) — nunca usado como cor de identidade/ação.
 */
export const BRAND = colors.blue
export const NAVY = colors.slate
export const SUCCESS = colors.emerald

/** Hex literais usados fora do Tailwind (paint properties do MapLibre GL). */
export const MAP_COLORS = {
  routeCasing: '#FFFFFF',
  routeLine: BRAND[600],
} as const
