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
const config = {
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
        /*
          ELEVAÇÃO EM CAMADAS. Uma sombra única e larga lê como "recorte
          flutuando"; três camadas — contato, corpo e sombra longa — leem como
          objeto com peso, que é o que separa um app polido de um protótipo. A
          última camada tem raio negativo para a sombra não vazar para os lados.

          `--edge-highlight` é o filete de luz na borda de cima (inset de 1px):
          branco forte no claro, quase imperceptível no escuro. É ele que dá o
          acabamento de "vidro" às superfícies flutuantes. Vem de variável para
          seguir o tema.

          Continuam azuladas, nunca pretas (handoff §4.5).
        */
        float: '0 1px 2px rgba(15,23,41,.05), 0 6px 14px rgba(15,23,41,.07), 0 16px 32px -6px rgba(15,23,41,.12), inset 0 1px 0 var(--edge-highlight)',
        field: '0 1px 2px rgba(15,23,41,.05), 0 8px 18px rgba(15,23,41,.09), 0 22px 40px -8px rgba(15,23,41,.16), inset 0 1px 0 var(--edge-highlight)',
        sheet: '0 -1px 2px rgba(15,23,41,.04), 0 -12px 32px rgba(15,23,41,.16), inset 0 1px 0 var(--edge-highlight)',
        'sheet-over-scrim': '0 -12px 32px rgba(15,23,41,.24), inset 0 1px 0 var(--edge-highlight)',
        tile: '0 1px 2px rgba(15,23,41,.06), 0 3px 8px rgba(15,23,41,.06)',
        // Chrome de navegação: escuro sobre escuro, precisa de mais peso.
        'nav-banner': '0 2px 4px rgba(5,8,15,.18), 0 14px 34px rgba(15,23,41,.34), inset 0 1px 0 rgba(255,255,255,.06)',
        'nav-panel': '0 -14px 34px rgba(15,23,41,.34), inset 0 1px 0 rgba(255,255,255,.06)',
        // Botões de ação carregam a sombra na própria cor, com o filete de luz em cima.
        primary: '0 1px 2px rgba(14,134,198,.35), 0 8px 18px rgba(14,134,198,.30), inset 0 1px 0 rgba(255,255,255,.28)',
        'go-btn': '0 1px 2px rgba(32,180,87,.35), 0 8px 18px rgba(32,180,87,.28), inset 0 1px 0 rgba(255,255,255,.28)',
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

/**
 * OPACIDADE EM TOKEN DE COR (`bg-brand-500/[.16]`, `border-danger-500/50`).
 *
 * O Tailwind só sabe aplicar o modificador de opacidade a uma cor que ele
 * consegue DECOMPOR em canais. `var(--brand-500)` é um hex dentro de uma
 * variável: opaco para ele, então a classe com `/NN` simplesmente NÃO É
 * GERADA — sem erro, sem aviso, o elemento fica sem a cor. Foi assim que
 * catorze classes do app (selo verde da chegada, tiles de aviso, ponto neutro
 * da nota, borda do alerta de trecho) passaram meses transparentes.
 *
 * Em vez de converter cada token para trio RGB (como `hairline`, que já é),
 * qualquer valor `var(--x)` aqui ganha uma função: sem modificador devolve a
 * variável intacta — a saída para o uso comum é idêntica à de antes — e com
 * modificador devolve `color-mix` com a mesma variável. Vale para todo token
 * presente e futuro, e continua seguindo o tema porque a variável é a mesma.
 */
function withOpacity(value) {
  return ({ opacityValue }) =>
    // Sem modificador o Tailwind passa `undefined` OU a variável interna
    // `var(--tw-*-opacity)`. Nos dois casos a saída tem de ser a variável pura:
    // se o uso COMUM virasse `color-mix`, um navegador sem suporte a ele
    // perderia todas as cores do app, não só as translúcidas.
    opacityValue === undefined || opacityValue === '1' || String(opacityValue).startsWith('var(--tw-')
      ? value
      : `color-mix(in srgb, ${value} calc(${opacityValue} * 100%), transparent)`
}

function opacityAware(node) {
  if (typeof node === 'string') return node.startsWith('var(--') ? withOpacity(node) : node
  if (node && typeof node === 'object') {
    return Object.fromEntries(Object.entries(node).map(([key, child]) => [key, opacityAware(child)]))
  }
  return node
}

config.theme.extend.colors = opacityAware(config.theme.extend.colors)

export default config
