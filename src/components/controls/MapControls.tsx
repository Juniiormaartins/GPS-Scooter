import { Icon } from '@/components/ui/Icon'
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
  /** Liga/desliga a camada de adequação das vias. Ausente = controle não aparece (ex: durante a navegação). */
  onToggleSuitability?: () => void
  suitabilityActive?: boolean
}

/**
 * Pilha de controles do mapa (handoff §5.1 `MapControls`): coluna à direita,
 * botões de 48×48px, raio 18px, gap de 10px.
 *
 * O handoff prevê três botões: centralizar, orientação e CAMADAS. O terceiro
 * ficou ausente enquanto não havia camada nenhuma para escolher — um botão que
 * abre um seletor vazio seria funcionalidade inventada. Agora existe uma: a
 * camada de adequação das vias (ver suitabilityLayer.ts), e o botão é um
 * INTERRUPTOR dela, não um seletor: com uma opção só, um menu seria um toque a
 * mais para chegar no mesmo lugar.
 */
export function MapControls({
  onCenterOnUser,
  isLocating,
  isFollowing = false,
  onResetNorth,
  bearingDeg = 0,
  onToggleSuitability,
  suitabilityActive = false,
}: MapControlsProps) {
  return (
    <div className="pip-hide pointer-events-auto flex flex-col gap-2.5">
      {onToggleSuitability && (
        <ControlButton
          onClick={onToggleSuitability}
          label={suitabilityActive ? 'Ocultar adequação das vias' : 'Ver adequação das vias'}
          active={suitabilityActive}
        >
          {/* Camadas empilhadas — o símbolo convencional de "camada de mapa". */}
          <Icon name="layers" active={suitabilityActive} />
        </ControlButton>
      )}
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
          <Icon name="locate" active={isFollowing} />
        )}
      </ControlButton>

      {onResetNorth && (
        <ControlButton onClick={onResetNorth} label="Orientar o mapa para o norte">
          {/*
            Agulha girada pelo rumo REAL do mapa: com o mapa ao norte ela
            aponta para cima; girado, ela mostra onde o norte ficou. Sem essa
            rotação o ícone seria só um enfeite estático.
          */}
          <span className="flex transition-transform duration-base ease-standard" style={{ transform: `rotate(${-bearingDeg}deg)` }}>
            <Icon name="compass" />
          </span>
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
