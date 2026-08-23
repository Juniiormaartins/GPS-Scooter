import { useEffect, useState, type ReactNode } from 'react'

interface PanelProps {
  title: string
  onClose: () => void
  children: ReactNode
}

/**
 * Painel de tela cheia com deslizar-de-baixo, usado por Menu/Perfil/Salvos/
 * Atividade — telas secundárias que não precisam do gesto de arraste do
 * BottomSheet (esse é reservado à seleção de rota, o fluxo principal).
 * Respeita a área segura do iPhone no topo e na base. Entra com uma
 * transição curta (translateY + fade) para não parecer que o conteúdo
 * simplesmente "aparece" por cima do mapa.
 */
export function Panel({ title, onClose, children }: PanelProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div
      className={`pointer-events-auto absolute inset-0 z-30 flex flex-col bg-white transition-all duration-200 ease-out ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
      }`}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <h2 className="text-lg font-bold text-navy-900">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 active:bg-slate-100"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">{children}</div>
    </div>
  )
}
