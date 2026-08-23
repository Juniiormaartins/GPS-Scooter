import colors from 'tailwindcss/colors.js'

/**
 * Identidade visual do GPS Scooter — modo escuro, réplica do protótipo Figma:
 * ciano (marca/ação primária/links), verde (ir/recomendado/ligado), âmbar
 * (alternativa/atenção), vermelho (rota inadequada/ação destrutiva), sobre
 * superfícies quase pretas (`surface`). Ver src/config/theme.ts para a mesma
 * fonte de tokens usada fora do Tailwind (mapa/markers).
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: colors.sky,
        navy: colors.slate,
        success: colors.green,
        warning: colors.amber,
        danger: colors.rose,
        surface: {
          DEFAULT: '#0A0E1A',
          card: '#151C2E',
          raised: '#1C2540',
        },
      },
      fontFamily: {
        sans: ['"Baloo 2"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        floating: '0 8px 30px rgba(0, 0, 0, 0.45)',
      },
    },
  },
  plugins: [],
}
