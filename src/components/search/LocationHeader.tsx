interface LocationHeaderProps {
  /** Via em que o usuário está. null enquanto a localização não foi resolvida. */
  currentStreet: string | null
  /** Bairro · cidade, quando conhecido. */
  currentArea: string | null
  isLocating: boolean
  onProfileClick: () => void
  onMenuClick: () => void
}

/**
 * Cabeçalho de localização da tela de exploração (handoff tela 01, item 2).
 *
 * TRANSPARENTE de propósito: sem fundo e sem sombra, para o mapa continuar
 * sendo a superfície. Os dois botões têm fundo branco próprio — são eles que
 * garantem o alvo de toque e a legibilidade sobre qualquer parte do mapa.
 *
 * O handoff desenha um AVATAR com foto e badge. Este produto não tem contas
 * nem perfis com foto: mostrar um retrato genérico afirmaria uma conta que
 * não existe. O botão mantém a posição, o tamanho e o badge — o badge indica
 * o veículo pareado, que é um estado real —, com o ícone de pessoa no lugar
 * da foto.
 */
export function LocationHeader({
  currentStreet,
  currentArea,
  isLocating,
  onProfileClick,
  onMenuClick,
}: LocationHeaderProps) {
  return (
    <div className="pointer-events-none flex items-center gap-3">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Abrir menu"
        className="pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-surface-card text-content-primary shadow-float transition-all duration-fast ease-standard active:scale-[.97] active:opacity-[.88]"
      >
        <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      <div className="pointer-events-none flex min-w-0 flex-1 items-center gap-2.5">
        <span
          className={`h-[9px] w-[9px] shrink-0 rounded-pill bg-brand-500 ${isLocating ? 'animate-pulse' : ''}`}
        />
        <div className="min-w-0">
          <p className="truncate text-[17px] font-extrabold leading-tight text-content-primary">
            {currentStreet ?? (isLocating ? 'Localizando…' : 'Sua localização')}
          </p>
          {currentArea && (
            <p className="truncate text-[13px] font-semibold leading-tight text-content-secondary">{currentArea}</p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onProfileClick}
        aria-label="Perfil"
        className="pointer-events-auto relative flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-pill bg-surface-card text-content-secondary shadow-float transition-all duration-fast ease-standard active:scale-[.97] active:opacity-[.88]"
      >
        <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="3.6" />
          <path d="M4.8 20a7.6 7.6 0 0 1 14.4 0" />
        </svg>
      </button>
    </div>
  )
}

interface SearchBarProps {
  onOpenSearch: () => void
  /** Texto já escolhido, quando existir — a barra passa a mostrá-lo em vez do placeholder. */
  value?: string | null
}

/**
 * Campo de busca da tela 01 (handoff: 58px, raio 22px, lupa à esquerda,
 * botão circular de 42px à direita).
 *
 * NÃO é um input: é um gatilho que abre a tela de busca em tela cheia, que é
 * onde o handoff colocou a experiência de pesquisa (campo focado, categorias,
 * resultados). Manter um input aqui duplicaria estado com aquela tela.
 */
export function SearchBar({ onOpenSearch, value = null }: SearchBarProps) {
  return (
    <button
      type="button"
      onClick={onOpenSearch}
      className="pointer-events-auto flex h-[58px] w-full items-center gap-3 rounded-field border border-hairline/[.06] bg-surface-card pl-[18px] pr-2 text-left shadow-field transition-all duration-fast ease-standard active:scale-[.97] active:opacity-[.88]"
    >
      <svg viewBox="0 0 24 24" className="h-[22px] w-[22px] shrink-0 text-content-tertiary" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.6-3.6" />
      </svg>

      <span
        className={`min-w-0 flex-1 truncate text-field-text ${value ? 'text-content-primary' : 'text-content-tertiary'}`}
      >
        {value ?? 'Para onde você quer ir?'}
      </span>

      <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-pill bg-surface-tile-accent text-brand-500">
        <svg viewBox="0 0 24 24" className="h-[20px] w-[20px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
      </span>
    </button>
  )
}
