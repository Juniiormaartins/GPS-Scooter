import type { ReactNode } from 'react'

/**
 * Botão de ação. Implementa o contrato de design/gps-scooter-ui/components/core/Button.
 *
 * Variantes têm função fixa (regra da marca): `go` é o CTA de confirmar/iniciar,
 * `primary` é navegação/seleção, `destructive` é rótulo vermelho sobre card.
 * O press é `scale(0.97)` + 88% de opacidade — a cor de fundo NÃO muda.
 */
export interface ButtonProps {
  variant?: 'go' | 'primary' | 'secondary' | 'quiet' | 'ghost' | 'destructive'
  size?: 'lg' | 'md' | 'sm'
  disabled?: boolean
  icon?: ReactNode
  children?: ReactNode
  onClick?: () => void
  className?: string
  type?: 'button' | 'submit'
}

const VARIANT: Record<NonNullable<ButtonProps['variant']>, string> = {
  go: 'bg-success-500 text-content-on-accent shadow-go-btn',
  primary: 'bg-brand-500 text-content-on-accent shadow-primary',
  secondary: 'bg-surface-sunken text-content-primary',
  quiet: 'bg-brand-500/[.16] text-brand-500',
  ghost: 'bg-transparent text-brand-500',
  destructive: 'bg-surface-card text-danger-500',
}

/**
 * Alturas do handoff (§4.3): botão primário 56px; par secundário/primário
 * 52px; secundário raio 18px. O `lg` é o primário de sheet.
 */
const SIZE: Record<NonNullable<ButtonProps['size']>, string> = {
  lg: 'h-14 text-btn-primary rounded-lg px-6',
  md: 'h-[52px] text-btn-secondary rounded-lg px-5',
  sm: 'h-9 text-[14px] rounded-pill px-3.5',
}

export function Button({
  variant = 'primary',
  size = 'lg',
  disabled = false,
  icon,
  children,
  onClick,
  className = '',
  type = 'button',
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex w-full items-center justify-center gap-2 font-extrabold transition-all duration-fast ease-standard active:scale-[.97] active:opacity-[.88] disabled:cursor-not-allowed disabled:opacity-40 ${VARIANT[variant]} ${SIZE[size]} ${className}`}
    >
      {icon}
      {children}
    </button>
  )
}
