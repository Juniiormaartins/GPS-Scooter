/**
 * Tema do GPS Scooter — tradução direta dos design tokens do handoff
 * (design/gps-scooter-ui/tokens/*.css). Os VALORES aqui devem bater
 * exatamente com aqueles arquivos; a implementação (Tailwind) é a do projeto.
 *
 * Regras de cor do handoff, resumidas:
 * - profundidade em fundo escuro sobe a rampa `ink` (950 → 600), não usa sombra;
 * - cada acento tem função fixa: brand=navegação/seleção, success=confirmar/bateria,
 *   warning=salvos/alternativa, danger=destrutivo/via não recomendada;
 * - cor nunca é decoração; não existe tema claro.
 *
 * Ver src/config/theme.ts para os mesmos tokens expostos como hex literais,
 * usados onde não dá para aplicar classe Tailwind (paint do MapLibre).
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Rampa de superfícies — do fundo do app ao elemento mais elevado.
        ink: {
          1000: '#05080F',
          950: '#0A0E1A',
          900: '#0E1424',
          850: '#131C2E',
          800: '#1A2438',
          700: '#212D45',
          600: '#2B3A56',
          500: '#3B4C6B',
        },
        surface: {
          DEFAULT: '#0A0E1A', // --bg-app
          map: '#0E1424', // --bg-map
          sunken: '#131C2E', // faixa de busca, opção de rota não selecionada
          card: '#1A2438', // cards, linhas de lista, bottom sheet
          raised: '#212D45', // chips, card selecionado, botão secundário
          tile: '#2B3A56', // tile de ícone
        },
        brand: {
          300: '#8EDAFC',
          400: '#5CC7FA',
          500: '#35B7F7', // --accent-primary
          600: '#0E86C6',
        },
        success: {
          400: '#5CE08E',
          500: '#2FD16A', // --accent-go
          600: '#20B457',
        },
        warning: {
          // O handoff define um único âmbar (500). As variantes claras existem só
          // para os componentes ainda não migrados; elas somem na etapa de acabamento.
          300: '#F9CA80',
          400: '#F7B851',
          500: '#F5A623', // --accent-warn
        },
        danger: {
          400: '#F46B6B',
          500: '#F04545', // --accent-danger
        },
        // Texto — hierarquia vem de peso e tamanho; a cor só separa níveis.
        content: {
          primary: '#FFFFFF',
          secondary: '#8A9CB6',
          tertiary: '#64748B',
          'on-accent': '#05080F', // texto sobre botão azul/verde
        },
      },
      fontFamily: {
        sans: ['Nunito', '"SF Pro Rounded"', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Papéis tipográficos do handoff (tamanho + line-height + tracking juntos).
        'screen-title': ['34px', { lineHeight: '1.1', letterSpacing: '-0.4px', fontWeight: '800' }],
        'nav-title': ['22px', { lineHeight: '1.2', fontWeight: '800' }],
        metric: ['26px', { lineHeight: '1.15', letterSpacing: '-0.2px', fontWeight: '800' }],
        'row-title': ['17px', { lineHeight: '1.25', fontWeight: '700' }],
        body: ['15px', { lineHeight: '1.4', fontWeight: '400' }],
        caption: ['13px', { lineHeight: '1.35', fontWeight: '400' }],
        eyebrow: ['12px', { lineHeight: '1.2', letterSpacing: '1.2px', fontWeight: '800' }],
        tag: ['11px', { letterSpacing: '0.6px', fontWeight: '800' }],
      },
      spacing: {
        gutter: '20px', // lateral de toda tela
        stack: '12px', // entre cards irmãos
        group: '24px', // entre grupos rotulados
        card: '16px', // padding interno de card
        row: '72px', // altura mínima de linha de lista
        tap: '44px', // alvo de toque mínimo
      },
      borderRadius: {
        sm: '8px', // tags
        md: '12px', // tile de ícone, campo de busca
        lg: '16px', // stat tile, opção de rota
        xl: '20px', // card, linha de lista
        '2xl': '28px', // bottom sheet, barra flutuante
        pill: '999px',
      },
      boxShadow: {
        float: '0 8px 24px rgba(0,0,0,.45)',
        sheet: '0 -12px 32px rgba(0,0,0,.55)',
        tile: '0 2px 6px rgba(0,0,0,.30)',
        // Glow só em geometria viva de navegação (linha da rota, marcador).
        route: '0 0 16px rgba(53,183,247,.45)',
        go: '0 0 20px rgba(47,209,106,.35)',
      },
      backgroundImage: {
        // Gradiente de proteção atrás da UI flutuante sobre o mapa.
        'scrim-top': 'linear-gradient(180deg,rgba(10,14,26,.92) 0%,rgba(10,14,26,0) 100%)',
        'scrim-bottom': 'linear-gradient(0deg,rgba(10,14,26,.92) 0%,rgba(10,14,26,0) 100%)',
      },
      transitionDuration: {
        fast: '120ms', // press
        base: '200ms', // seleção, toggle, chip
        slow: '320ms', // bottom sheet, push de tela
      },
      transitionTimingFunction: {
        standard: 'cubic-bezier(.4,0,.2,1)',
        'ease-out-soft': 'cubic-bezier(.16,1,.3,1)', // entradas, sem overshoot
      },
    },
  },
  plugins: [],
}
