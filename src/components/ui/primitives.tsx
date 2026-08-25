import type { ReactNode } from 'react'

/**
 * Primitivos visuais do handoff (design/gps-scooter-ui/components/core/).
 * Agrupados num arquivo só porque cada um é pequeno e eles quase sempre são
 * usados juntos; os contratos de props seguem os `.d.ts` do pacote.
 *
 * Regra de profundidade em fundo escuro: elevação sobe a rampa de superfícies
 * (card → raised → tile), não usa sombra. Sombra só em chrome flutuante.
 */

/** Superfície arredondada. `selected` desenha a borda azul de 2px — a única borda colorida do sistema. */
export function Card({
  tone = 'card',
  selected = false,
  padded = true,
  blur = false,
  children,
  className = '',
}: {
  tone?: 'card' | 'raised' | 'sunken' | 'overlay'
  selected?: boolean
  padded?: boolean
  blur?: boolean
  children?: ReactNode
  className?: string
}) {
  const TONE = {
    card: 'bg-surface-card',
    raised: 'bg-surface-raised',
    sunken: 'bg-surface-sunken',
    overlay: 'bg-surface-overlay shadow-float',
  }[tone]

  return (
    <div
      className={`rounded-xl ${TONE} ${padded ? 'p-card' : ''} ${blur ? 'backdrop-blur-xl' : ''} ${
        selected ? 'border-2 border-brand-500' : 'border border-hairline/10'
      } ${className}`}
    >
      {children}
    </div>
  )
}

/** Rótulo de classificação em caixa alta (ex: "RECOMENDADA"). */
export function Tag({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: 'go' | 'accent' | 'warn' | 'danger' | 'neutral'
  children?: ReactNode
  className?: string
}) {
  const TONE = {
    go: 'bg-success-500/[.16] text-success-500',
    accent: 'bg-brand-500/[.16] text-brand-500',
    warn: 'bg-warning-500/[.16] text-warning-500',
    danger: 'bg-danger-500/[.16] text-danger-500',
    neutral: 'bg-surface-tile text-content-secondary',
  }[tone]

  return <span className={`inline-flex items-center rounded-sm px-2 py-1 text-tag uppercase ${TONE} ${className}`}>{children}</span>
}

/** Seletor de categoria em pílula (ex: "Restaurantes", "Postos"). */
export function Chip({
  selected = false,
  onClick,
  children,
}: {
  selected?: boolean
  onClick?: () => void
  children?: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-pill px-4 py-2.5 text-[15px] font-bold transition-all duration-base ease-standard active:scale-[.97] active:opacity-[.88] ${
        selected ? 'border-2 border-brand-500 bg-surface-raised text-content-primary' : 'border border-hairline/10 bg-surface-raised text-content-secondary'
      }`}
    >
      {children}
    </button>
  )
}

/** Eyebrow em caixa alta acima de um grupo (ex: "LOCAIS FAVORITOS"). */
export function SectionLabel({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return <p className={`text-eyebrow uppercase text-content-secondary ${className}`}>{children}</p>
}

/** Rótulo + métrica em caixa, usado em grades 2×2. */
export function StatTile({
  label,
  value,
  tone = 'default',
  className = '',
}: {
  label: string
  value: ReactNode
  tone?: 'default' | 'go' | 'accent'
  className?: string
}) {
  const VALUE_TONE = { default: 'text-content-primary', go: 'text-success-500', accent: 'text-brand-500' }[tone]

  return (
    <div className={`rounded-lg border border-hairline/10 bg-surface-card p-card ${className}`}>
      <p className="text-eyebrow uppercase text-content-tertiary">{label}</p>
      <p className={`mt-1.5 text-metric ${VALUE_TONE}`}>{value}</p>
    </div>
  )
}

/**
 * Linha de lista com tile de ícone — o componente mais reutilizado do sistema
 * (resultados de busca, lugares salvos, histórico de corridas).
 * `divider` troca o fundo de card por uma hairline inferior (resultados de busca).
 */
export function ListRow({
  icon,
  iconShape = 'square',
  tone = 'neutral',
  title,
  subtitle,
  trailing,
  chevron = false,
  divider = false,
  onClick,
}: {
  icon?: ReactNode
  iconShape?: 'square' | 'circle'
  tone?: 'neutral' | 'accent' | 'warn' | 'go'
  title: ReactNode
  subtitle?: ReactNode
  trailing?: ReactNode
  chevron?: boolean
  divider?: boolean
  onClick?: () => void
}) {
  const TILE = {
    neutral: 'bg-surface-tile text-content-secondary',
    accent: 'bg-brand-500/[.16] text-brand-500',
    warn: 'bg-surface-tile text-warning-500',
    go: 'bg-surface-tile text-success-500',
  }[tone]

  const Element = onClick ? 'button' : 'div'

  return (
    <Element
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={`flex min-h-row w-full items-center gap-4 px-card py-3 text-left transition-all duration-fast ease-standard ${
        divider ? 'border-b border-hairline/10' : 'rounded-xl border border-hairline/10 bg-surface-card'
      } ${onClick ? 'active:scale-[.97] active:opacity-[.88]' : ''}`}
    >
      {icon && (
        <span
          className={`flex h-[52px] w-[52px] shrink-0 items-center justify-center ${
            iconShape === 'circle' ? 'rounded-pill' : 'rounded-md'
          } ${TILE}`}
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-row-title text-content-primary">{title}</span>
        {subtitle && <span className="mt-[3px] block truncate text-body text-content-secondary">{subtitle}</span>}
      </span>
      {trailing && <span className="shrink-0 text-[16px] font-bold text-content-secondary">{trailing}</span>}
      {chevron && (
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-content-tertiary" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </Element>
  )
}
