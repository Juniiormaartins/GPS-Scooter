import { useEffect, useState, type ReactNode } from 'react'

interface PanelProps {
  title: string
  onClose: () => void
  /** Elemento à direita do título (normalmente um Button variant="quiet" size="sm"). */
  action?: ReactNode
  children: ReactNode
}

/**
 * Tela secundária de lista (Salvos / Atividade / Perfil), com o `NavHeader`
 * variante "title" do handoff: título grande de 34px/800 e uma ação opcional
 * à direita. Entra deslizando de baixo, respeitando as safe areas do iPhone.
 *
 * O gutter lateral de 20px e o header de 56px de altura mínima vêm dos tokens
 * (design/gps-scooter-ui/tokens/spacing.css).
 */
export function Panel({ title, onClose, action, children }: PanelProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div
      className={`pointer-events-auto absolute inset-0 z-30 flex flex-col bg-surface transition-all duration-slow ease-ease-out-soft ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      }`}
    >
      <div className="flex min-h-[56px] shrink-0 items-center justify-between gap-4 px-gutter pb-2 pt-[max(1rem,var(--safe-top))]">
        <h1 className="text-screen-title text-content-primary">{title}</h1>
        <div className="flex shrink-0 items-center gap-2">
          {action}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            /* 44px de alvo de toque; o ícone segue com 24px. */
            className="flex h-11 w-11 items-center justify-center rounded-pill text-content-secondary transition-all duration-fast active:scale-[.97] active:opacity-[.88]"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-gutter pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2">{children}</div>
    </div>
  )
}
