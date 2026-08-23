interface MapControlsProps {
  onCenterOnUser: () => void
  isLocating: boolean
  /** Quando true, a câmera já está acompanhando a posição do usuário — o botão fica em estado "ativo". */
  isFollowing?: boolean
}

/**
 * Botão de "minha localização". Fora da navegação, apenas centraliza uma vez.
 * Durante a navegação, comunica se a câmera está no modo "seguir" (estado
 * ativo, preenchido) ou se o usuário arrastou o mapa e o acompanhamento foi
 * interrompido (estado neutro) — tocar o botão retoma o acompanhamento.
 */
export function MapControls({ onCenterOnUser, isLocating, isFollowing = false }: MapControlsProps) {
  return (
    <div className="pointer-events-auto flex flex-col gap-3">
      <button
        type="button"
        onClick={onCenterOnUser}
        aria-label={isFollowing ? 'Seguindo sua localização' : 'Centralizar na localização atual'}
        title={isFollowing ? 'Seguindo sua localização' : 'Centralizar na localização atual'}
        className={`flex h-12 w-12 items-center justify-center rounded-full shadow-floating active:scale-95 ${
          isFollowing ? 'bg-brand-600 text-white' : 'bg-white text-brand-600'
        }`}
      >
        {isLocating ? (
          <span
            className={`h-4 w-4 animate-spin rounded-full border-2 border-t-transparent ${
              isFollowing ? 'border-white' : 'border-brand-500'
            }`}
          />
        ) : (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <circle cx="12" cy="12" r="3" fill={isFollowing ? 'currentColor' : 'none'} />
            <path d="M12 2v3M12 19v3M22 12h-3M5 12H2" strokeLinecap="round" />
          </svg>
        )}
      </button>
    </div>
  )
}
