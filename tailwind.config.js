import colors from 'tailwindcss/colors.js'

/**
 * Identidade visual do GPS Scooter: azul (marca/navegação/ação) + grafite/navy
 * (texto/superfícies escuras) + verde (reservado a significado semântico,
 * nunca usado como cor de identidade). Ver src/config/theme.ts para a mesma
 * fonte de tokens usada fora do Tailwind (mapa/markers).
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: colors.blue,
        navy: colors.slate,
        success: colors.emerald,
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        floating: '0 8px 30px rgba(0, 0, 0, 0.15)',
      },
    },
  },
  plugins: [],
}
