interface MapControlsProps {
  onCenterOnUser: () => void
  isLocating: boolean
  /** Durante a navegação: true quando a câmera já acompanha o usuário — o botão fica em estado "ativo". */
  isFollowing?: boolean
  /**
   * Volta o mapa ao norte. Ausente = controle não aparece.
   *
   * A bússola só faz sentido quando o mapa PODE estar girado — o que acontece
   * na navegação (a câmera acompanha o rumo) e quando o usuário gira com dois
   * dedos. Fora disso o botão seria decorativo.
   */
  onResetNorth?: () => void
  /** Rumo atual do mapa em graus. 0 = norte; a agulha gira para refletir isso. */
  bearingDeg?: number
}

/**
 * Pilha de controles do mapa (handoff §5.1 `MapControls`): coluna à direita,
 * botões de 48×48px, raio 18px, gap de 10px.
 *
 * O handoff prevê três botões: centralizar, orientação e CAMADAS. O terceiro
 * não foi implementado: ele abriria "o seletor de camadas do mapa existente",
 * e esse seletor não existe neste projeto — não há camadas alternativas
 * (satélite, trânsito) para escolher. Criar um botão que abre um seletor vazio
 * seria inventar funcionalidade, coisa que o próprio handoff proíbe (§11.8) e
 * manda perguntar em vez de improvisar (introdução do README).
 */
export function MapControls({
  onCenterOnUser,
  isLocating,
  isFollowing = false,
  onResetNorth,
  bearingDeg = 0,
}: MapControlsProps) {
  return (
    <div className="pointer-events-auto flex flex-col gap-2.5">
      <ControlButton
        onClick={onCenterOnUser}
        label={isFollowing ? 'Seguindo sua localização' : 'Centralizar na sua localização'}
        // Azul preenchido quando a câmera está travada no usuário: o estado é
        // lido pela cor, sem precisar de rótulo.
        active={isFollowing}
      >
        {isLocating ? (
          <span
            className={`h-[18px] w-[18px] animate-spin rounded-pill border-2 border-t-transparent ${
              isFollowing ? 'border-content-on-accent' : 'border-brand-500'
            }`}
          />
        ) : (
          <svg
            viewBox="0 0 24 24"
            className="h-[22px] w-[22px]"
            fill={isFollowing ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M21 3L3 10.5l7.5 3.2L13.5 21 21 3z" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
        )}
      </ControlButton>

      {onResetNorth && (
        <ControlButton onClick={onResetNorth} label="Orientar o mapa para o norte">
          {/*
            Agulha girada pelo rumo REAL do mapa: com o mapa ao norte ela
            aponta para cima; girado, ela mostra onde o norte ficou. Sem essa
            rotação o ícone seria só um enfeite estático.
          */}
          <svg
            viewBox="0 0 24 24"
            className="h-[22px] w-[22px] transition-transform duration-base ease-standard"
            style={{ transform: `rotate(${-bearingDeg}deg)` }}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.9}
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M15.2 8.8 13.4 13.4 8.8 15.2 10.6 10.6Z" fill="currentColor" />
          </svg>
        </ControlButton>
      )}
    </div>
  )
}

function ControlButton({
  onClick,
  label,
  active = false,
  children,
}: {
  onClick: () => void
  label: string
  active?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex h-12 w-12 items-center justify-center rounded-lg border border-hairline/[.06] shadow-float backdrop-blur-xl transition-all duration-fast ease-standard active:scale-[.97] active:opacity-[.88] ${
        active ? 'bg-brand-500 text-content-on-accent' : 'bg-surface-overlay text-brand-500'
      }`}
    >
      {children}
    </button>
  )
}
