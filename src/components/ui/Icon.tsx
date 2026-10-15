import type { ReactNode } from 'react'

/**
 * BIBLIOTECA DE ÍCONES DO APP — uma família só.
 *
 * POR QUE EXISTE. Os ícones eram SVGs avulsos, cada um desenhado num arquivo,
 * por mão diferente: traço de 1,9 num lugar, 2,2 em outro, cantos vivos na
 * estrela e redondos no relógio, tamanho óptico variando. Lado a lado, na barra
 * inferior, liam como pacote genérico — o que se descreve como "amador" sem
 * conseguir apontar o porquê. A inconsistência é o porquê.
 *
 * AS REGRAS DA FAMÍLIA, que valem para todo glifo daqui:
 * - grade de 24px, glifo ocupando ~18–20px (respiro de 2–3px nas bordas);
 * - traço de 1,9, pontas e junções ARREDONDADAS;
 * - sem preenchimento sólido no estado normal; no estado ATIVO ganha um corpo
 *   translúcido (`soft`) por baixo do traço — o acabamento "duotone", em que
 *   a forma ganha volume sem trocar de desenho;
 * - a cor é `currentColor`: quem usa decide a cor, o ícone não tem opinião.
 *
 * Acrescentar um ícone é acrescentar uma entrada em `GLYPHS`; ninguém mais
 * desenha SVG à mão neste app.
 */

export type IconName =
  | 'explore'
  | 'saved'
  | 'activity'
  | 'profile'
  | 'menu'
  | 'search'
  | 'mic'
  | 'layers'
  | 'locate'
  | 'compass'
  | 'scooter'
  | 'bike'
  | 'close'
  | 'chevron-right'
  | 'chevron-up'
  | 'home'
  | 'work'
  | 'star'
  | 'route'
  | 'bolt'

interface Glyph {
  /** Traço do ícone. */
  draw: ReactNode
  /** Forma do corpo translúcido do estado ativo (atributo `d` de um path). */
  soft?: string
}

const GLYPHS: Record<IconName, Glyph> = {
  // Bússola: "explorar" — círculo e agulha. A agulha é o corpo do duotone.
  explore: {
    soft: 'M15.6 8.4l-2.1 5.1-5.1 2.1 2.1-5.1z',
    draw: (
      <>
        <circle cx="12" cy="12" r="8.6" />
        <path d="M15.6 8.4l-2.1 5.1-5.1 2.1 2.1-5.1z" />
      </>
    ),
  },
  // Estrela de cantos suaves: "salvar" — a mesma que o botão "Salvar" usa.
  saved: {
    soft: 'M12 3.9l2.45 5.05 5.55.8-4.03 3.9.96 5.5L12 16.5l-4.93 2.65.96-5.5L4 9.75l5.55-.8z',
    draw: <path d="M12 3.9l2.45 5.05 5.55.8-4.03 3.9.96 5.5L12 16.5l-4.93 2.65.96-5.5L4 9.75l5.55-.8z" />,
  },
  // Histórico: relógio com seta de volta — "o que eu já fiz", não só "que horas são".
  activity: {
    soft: 'M12 3.5a8.5 8.5 0 1 1-8.2 6.4L6 8z',
    draw: (
      <>
        <path d="M3.6 12.2A8.5 8.5 0 1 0 6.1 6" />
        <path d="M3.4 4.8V8.4H7" />
        <path d="M12 7.8V12l3 1.8" />
      </>
    ),
  },
  profile: {
    soft: 'M12 4.6a3.6 3.6 0 1 1 0 7.2 3.6 3.6 0 0 1 0-7.2z',
    draw: (
      <>
        <circle cx="12" cy="8.2" r="3.6" />
        <path d="M4.8 20.2a7.2 7.2 0 0 1 14.4 0" />
      </>
    ),
  },
  // Menu assimétrico: a segunda linha curta é o que tira o ar de "ícone de template".
  menu: { draw: <path d="M4.5 7.5h15M4.5 16.5h9.5" /> },
  search: {
    draw: (
      <>
        <circle cx="11" cy="11" r="6.6" />
        <path d="M20 20l-3.9-3.9" />
      </>
    ),
  },
  mic: {
    soft: 'M12 3.6a3 3 0 0 1 3 3v5.2a3 3 0 0 1-6 0V6.6a3 3 0 0 1 3-3z',
    draw: (
      <>
        <rect x="9" y="3.6" width="6" height="11.4" rx="3" />
        <path d="M5.6 11.4a6.4 6.4 0 0 0 12.8 0M12 17.8v2.6" />
      </>
    ),
  },
  layers: {
    soft: 'M12 3.6l8.4 4.2L12 12 3.6 7.8z',
    draw: (
      <>
        <path d="M12 3.6l8.4 4.2L12 12 3.6 7.8z" />
        <path d="M3.6 12.2L12 16.4l8.4-4.2" />
        <path d="M3.6 16.4L12 20.6l8.4-4.2" />
      </>
    ),
  },
  // Seta de navegação: "ir para onde estou".
  locate: {
    soft: 'M20.4 3.6L3.6 10.8l7 2.6 2.6 7z',
    draw: <path d="M20.4 3.6L3.6 10.8l7 2.6 2.6 7z" />,
  },
  // Agulha de norte — a que a bússola do mapa gira.
  compass: {
    draw: (
      <>
        <circle cx="12" cy="12" r="8.6" />
        <path d="M15.3 8.7l-1.8 4.8-4.8 1.8 1.8-4.8z" fill="currentColor" stroke="none" />
      </>
    ),
  },
  scooter: {
    soft: 'M8.2 18H16l-1.4-11H12z',
    draw: (
      <>
        <circle cx="6.2" cy="17.8" r="2.3" />
        <circle cx="17.8" cy="17.8" r="2.3" />
        <path d="M8.5 17.8h7M17.2 15.6L15.6 5.2H12.6" />
      </>
    ),
  },
  bike: {
    draw: (
      <>
        <circle cx="6" cy="16.4" r="3.1" />
        <circle cx="18" cy="16.4" r="3.1" />
        <path d="M6 16.4l3.6-7h4.6l3.8 7M9.6 9.4L12.6 16.4M14.2 9.4l.9-2.2h2" />
      </>
    ),
  },
  close: { draw: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /> },
  'chevron-right': { draw: <path d="M9.5 5.8l6.2 6.2-6.2 6.2" /> },
  'chevron-up': { draw: <path d="M5.8 14.5L12 8.3l6.2 6.2" /> },
  home: {
    soft: 'M4.5 11.2L12 4.6l7.5 6.6v8a1 1 0 0 1-1 1h-3.6v-5.4H9.1v5.4H5.5a1 1 0 0 1-1-1z',
    draw: <path d="M4.5 11.2L12 4.6l7.5 6.6v8a1 1 0 0 1-1 1h-3.6v-5.4H9.1v5.4H5.5a1 1 0 0 1-1-1z" />,
  },
  work: {
    soft: 'M4 8h16a1 1 0 0 1 1 1v9.2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z',
    draw: (
      <>
        <rect x="3" y="8" width="18" height="11.2" rx="2" />
        <path d="M8.6 8V6.4a1.8 1.8 0 0 1 1.8-1.8h3.2a1.8 1.8 0 0 1 1.8 1.8V8M3 13.2h18" />
      </>
    ),
  },
  star: {
    soft: 'M12 3.9l2.45 5.05 5.55.8-4.03 3.9.96 5.5L12 16.5l-4.93 2.65.96-5.5L4 9.75l5.55-.8z',
    draw: <path d="M12 3.9l2.45 5.05 5.55.8-4.03 3.9.96 5.5L12 16.5l-4.93 2.65.96-5.5L4 9.75l5.55-.8z" />,
  },
  route: {
    draw: (
      <>
        <circle cx="6.2" cy="6.2" r="2.4" />
        <circle cx="17.8" cy="17.8" r="2.4" />
        <path d="M8.6 6.2h5.4a3.6 3.6 0 0 1 0 7.2h-4a3.6 3.6 0 0 0 0 7.2h5.4" />
      </>
    ),
  },
  bolt: {
    soft: 'M13 3.4L5.8 13.2h5.4l-.9 7.4 7.4-10h-5.4z',
    draw: <path d="M13 3.4L5.8 13.2h5.4l-.9 7.4 7.4-10h-5.4z" />,
  },
}

export function Icon({
  name,
  size = 22,
  active = false,
  strokeWidth = 1.9,
  className = '',
}: {
  name: IconName
  size?: number
  /** Estado ativo: acrescenta o corpo translúcido (duotone) por baixo do traço. */
  active?: boolean
  strokeWidth?: number
  className?: string
}) {
  const glyph = GLYPHS[name]
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      {active && glyph.soft && <path d={glyph.soft} fill="currentColor" fillOpacity={0.2} stroke="none" />}
      {glyph.draw}
    </svg>
  )
}
