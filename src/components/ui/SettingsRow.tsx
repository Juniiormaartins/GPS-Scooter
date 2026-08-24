import type { ReactNode } from 'react'

/**
 * Linha de preferência com controle à direita — contrato de
 * design/gps-scooter-ui/components/forms/SettingsRow.
 * `tone="danger"` centraliza o rótulo e o pinta de vermelho (Sair da Conta).
 */
export function SettingsRow({
  label,
  icon,
  control = 'none',
  checked = false,
  value,
  action,
  tone = 'default',
  onChange,
  onClick,
}: {
  label: string
  icon?: ReactNode
  control?: 'toggle' | 'value' | 'action' | 'chevron' | 'none'
  checked?: boolean
  value?: string
  action?: string
  tone?: 'default' | 'danger'
  onChange?: (next: boolean) => void
  onClick?: () => void
}) {
  const interactive = control !== 'toggle' && Boolean(onClick)
  const Element = interactive ? 'button' : 'div'

  if (tone === 'danger') {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-xl border border-hairline/10 bg-surface-card px-card text-row-title text-danger-500 transition-all duration-fast ease-standard active:scale-[.97] active:opacity-[.88]"
      >
        {icon}
        {label}
      </button>
    )
  }

  return (
    <Element
      {...(interactive ? { type: 'button' as const, onClick } : {})}
      className={`flex min-h-[64px] w-full items-center gap-3.5 rounded-xl border border-hairline/10 bg-surface-card px-card py-3 text-left ${
        interactive ? 'transition-all duration-fast ease-standard active:scale-[.97] active:opacity-[.88]' : ''
      }`}
    >
      {icon && <span className="shrink-0 text-brand-500">{icon}</span>}
      <span className="min-w-0 flex-1 truncate text-row-title text-content-primary">{label}</span>

      {control === 'toggle' && <Toggle checked={checked} onChange={onChange} label={label} />}
      {control === 'value' && value && <span className="shrink-0 text-body text-content-secondary">{value}</span>}
      {control === 'action' && action && <span className="shrink-0 text-[15px] font-bold text-brand-500">{action}</span>}
      {control === 'chevron' && (
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-content-tertiary" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </Element>
  )
}

/** Interruptor 62×34 — verde quando ligado, trilho `ink-500` quando desligado. */
export function Toggle({
  checked = false,
  onChange,
  label,
}: {
  checked?: boolean
  onChange?: (next: boolean) => void
  label?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange?.(!checked)}
      className={`flex h-[34px] w-[62px] shrink-0 items-center rounded-pill p-[3px] transition-colors duration-base ease-standard ${
        checked ? 'justify-end bg-success-500' : 'justify-start bg-ink-500'
      }`}
    >
      <span className={`h-7 w-7 rounded-pill shadow-tile transition-all duration-base ${checked ? 'bg-white' : 'bg-[#B6C4D6]'}`} />
    </button>
  )
}
