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
        // Todas as cores vêm de variáveis CSS definidas em src/index.css, com
        // uma paleta por tema (claro/escuro). Assim `bg-surface-card` &
        // companhia funcionam nos dois temas sem duplicar classe no JSX.
        ink: {
          1000: '#05080F',
          500: '#3B4C6B',
        },
        surface: {
          DEFAULT: 'var(--surface)',
          map: 'var(--surface-map)',
          sunken: 'var(--surface-sunken)', // faixa de busca, opção de rota não selecionada
          card: 'var(--surface-card)', // cards, linhas de lista, bottom sheet
          overlay: 'var(--surface-overlay)', // painéis flutuando SOBRE o mapa (não deixam a cartografia tingir)
          raised: 'var(--surface-raised)', // chips, card selecionado, botão secundário
          tile: 'var(--surface-tile)', // tile de ícone
        },
        brand: {
          300: 'var(--brand-300)',
          400: 'var(--brand-400)',
          500: 'var(--brand-500)', // --accent-primary
          600: 'var(--brand-600)',
        },
        success: {
          400: 'var(--success-400)',
          500: 'var(--success-500)', // --accent-go
          600: 'var(--success-600)',
        },
        warning: {
          300: 'var(--warning-500)',
          400: 'var(--warning-500)',
          500: 'var(--warning-500)', // --accent-warn
        },
        danger: {
          400: 'var(--danger-500)',
          500: 'var(--danger-500)', // --accent-danger
        },
        // Texto — hierarquia vem de peso e tamanho; a cor só separa níveis.
        content: {
          primary: 'var(--content-primary)',
          secondary: 'var(--content-secondary)',
          tertiary: 'var(--content-tertiary)',
          'on-accent': 'var(--content-on-accent)', // texto sobre botão azul/verde
        },
        /**
         * Bordas e realces sutis. No escuro são brancos translúcidos; no claro,
         * escuros — por isso `--hairline` é um trio RGB e a opacidade continua
         * vindo do Tailwind (`border-hairline/10`).
         */
        hairline: 'rgb(var(--hairline) / <alpha-value>)',
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
