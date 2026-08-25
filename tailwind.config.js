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
          'tile-accent': 'var(--surface-tile-accent)', // tile de ícone com acento
          selected: 'var(--surface-selected)', // fundo do card/opção selecionada
          handle: 'var(--handle)', // pega da bottom sheet
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
          500: 'var(--warning-500)', // preenchimento/traço
          text: 'var(--warning-text)', // âmbar legível como TEXTO sobre claro
        },
        danger: {
          400: 'var(--danger-500)',
          500: 'var(--danger-500)', // --accent-danger
          text: 'var(--danger-text)',
        },
        /** Fundos de estado (§4.1) — usados atrás de tag/tile, nunca como cor de texto. */
        state: {
          go: 'var(--state-go)',
          warn: 'var(--state-warn)',
          danger: 'var(--state-danger)',
          info: 'var(--state-info)',
        },
        /**
         * Chrome da navegação ativa. NÃO inverte com o tema: o handoff (§4.1,
         * §7) define a navegação como escura sempre, para imersão.
         */
        nav: {
          surface: 'var(--nav-surface)',
          content: 'var(--nav-content)',
          'content-secondary': 'var(--nav-content-secondary)',
          accent: 'var(--nav-accent)',
          control: 'var(--nav-control)',
        },
        // Texto — hierarquia vem de peso e tamanho; a cor só separa níveis.
        content: {
          primary: 'var(--content-primary)',
          secondary: 'var(--content-secondary)',
          tertiary: 'var(--content-tertiary)',
          quaternary: 'var(--content-quaternary)', // eyebrow, desabilitado
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
        eyebrow: ['11px', { lineHeight: '1.2', letterSpacing: '1.4px', fontWeight: '800' }],
        tag: ['10.5px', { letterSpacing: '0.6px', fontWeight: '800' }],
        // Papéis novos do redesenho (§4.2). Peso 900 — a Nunito carregada tem.
        'sheet-title': ['22px', { lineHeight: '1.15', letterSpacing: '-0.5px', fontWeight: '900' }],
        'sheet-title-sm': ['20px', { lineHeight: '1.15', letterSpacing: '-0.4px', fontWeight: '900' }],
        maneuver: ['25px', { lineHeight: '1.15', letterSpacing: '-0.6px', fontWeight: '900' }],
        eta: ['30px', { lineHeight: '1.1', letterSpacing: '-0.8px', fontWeight: '900' }],
        'metric-card': ['24px', { lineHeight: '1.15', letterSpacing: '-0.6px', fontWeight: '900' }],
        'metric-tile': ['19px', { lineHeight: '1.15', letterSpacing: '-0.4px', fontWeight: '900' }],
        'row-name': ['16px', { lineHeight: '1.25', fontWeight: '800' }],
        'btn-primary': ['17px', { lineHeight: '1.2', fontWeight: '800' }],
        'btn-secondary': ['15.5px', { lineHeight: '1.2', fontWeight: '800' }],
        'field-text': ['16.5px', { lineHeight: '1.2', fontWeight: '600' }],
        'tab-label': ['11.5px', { lineHeight: '1.2', fontWeight: '700' }],
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
        sm: '8px', // tag de classificação
        md: '14px', // tile de ícone
        lg: '18px', // controle flutuante 48px, botão secundário
        tile: '16px', // tile de métrica, bloco recuado
        xl: '20px', // card, linha de lista, opção de rota
        field: '22px', // campo de busca
        bar: '24px', // barra de localização, pílula de status
        '2xl': '28px', // sheet, banner de navegação, barras flutuantes
        pill: '999px',
      },
      boxShadow: {
        // Sombras do tema claro (handoff §4.5): sombra difusa azulada, nunca preta.
        float: '0 8px 22px rgba(15,23,41,.12)',
        field: '0 10px 26px rgba(15,23,41,.14)',
        sheet: '0 -12px 32px rgba(15,23,41,.16)',
        'sheet-over-scrim': '0 -12px 32px rgba(15,23,41,.24)',
        tile: '0 2px 6px rgba(15,23,41,.08)',
        // Chrome de navegação: escuro sobre escuro, precisa de mais peso.
        'nav-banner': '0 14px 34px rgba(15,23,41,.34)',
        'nav-panel': '0 -14px 34px rgba(15,23,41,.34)',
        // Botões de ação carregam a sombra na própria cor.
        primary: '0 10px 24px rgba(14,134,198,.35)',
        'go-btn': '0 10px 22px rgba(32,180,87,.30)',
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
