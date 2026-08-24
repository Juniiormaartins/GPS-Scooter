interface MapControlsProps {
  onCenterOnUser: () => void
  isLocating: boolean
  /** Durante a navegação: true quando a câmera já acompanha o usuário — o botão fica em estado "ativo". */
  isFollowing?: boolean
}

/**
 * Botão "minha localização". Função real e necessária: fora da navegação
 * centraliza o mapa na posição atual; durante a navegação, retoma o
 * acompanhamento da câmera depois que o usuário arrastou o mapa para explorar.
 *
 * O ícone é a seta de localização (padrão em apps de navegação), não mais a
 * mira com traços radiais que parecia um "solzinho". Quando está seguindo, a
 * seta fica preenchida sobre o fundo azul; quando não, fica só o contorno —
 * a diferença de estado é imediata sem precisar de rótulo.
 *
 * Posicionamento é responsabilidade de quem usa (App.tsx), que conhece a
 * altura dos painéis flutuantes de cada tela e evita sobreposição.
 */
export function MapControls({ onCenterOnUser, isLocating, isFollowing = false }: MapControlsProps) {
  return (
    <button
      type="button"
      onClick={onCenterOnUser}
      aria-label={isFollowing ? 'Seguindo sua localização' : 'Centralizar na sua localização'}
      className={`pointer-events-auto flex h-12 w-12 items-center justify-center rounded-pill border border-white/10 shadow-float backdrop-blur-xl transition-all duration-fast ease-standard active:scale-[.97] active:opacity-[.88] ${
        isFollowing ? 'bg-brand-500 text-content-on-accent' : 'bg-surface-card/[.86] text-brand-500'
      }`}
    >
      {isLocating ? (
        <span
          className={`h-[18px] w-[18px] animate-spin rounded-pill border-2 border-t-transparent ${
            isFollowing ? 'border-content-on-accent' : 'border-brand-500'
          }`}
        />
      ) : (
        <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill={isFollowing ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
          <path d="M21 3L3 10.5l7.5 3.2L13.5 21 21 3z" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      )}
    </button>
  )
}
