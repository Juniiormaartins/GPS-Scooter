interface LocationHeaderProps {
  /** Via em que o usuário está. null enquanto a localização não foi resolvida. */
  currentStreet: string | null
  /** Bairro · cidade, quando conhecido. */
  currentArea: string | null
  isLocating: boolean
  onProfileClick: () => void
  onMenuClick: () => void
  /** Foto do avatar escolhida no Perfil. null = ícone padrão. */
  avatarDataUrl?: string | null
  /**
   * Abre a troca de origem. Ausente = o cabeçalho é só informativo.
   *
   * Fica AQUI e não num controle novo porque é aqui que a origem já é exibida:
   * o lugar natural de trocar uma informação é onde ela está escrita.
   */
  onEditOrigin?: () => void
  /**
   * True quando a origem foi definida À MÃO, e não pelo GPS.
   *
   * Precisa ser visível, e não um detalhe: o app faz afirmações de segurança e
   * de autonomia a partir da origem. Se ela é fictícia, quem olha a tela tem de
   * saber disso sem precisar lembrar que digitou algo minutos atrás.
   */
  isManualOrigin?: boolean
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
  avatarDataUrl = null,
  onEditOrigin,
  isManualOrigin = false,
}: LocationHeaderProps) {
  const Bloco = onEditOrigin ? 'button' : 'div'
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

      <Bloco
        {...(onEditOrigin
          ? {
              type: 'button' as const,
              onClick: onEditOrigin,
              'aria-label': isManualOrigin
                ? `Origem definida manualmente: ${currentStreet ?? 'sem nome'}. Tocar para trocar.`
                : 'Trocar o ponto de partida',
            }
          : {})}
        className={`flex min-w-0 flex-1 items-center gap-2.5 text-left ${
          onEditOrigin ? 'pointer-events-auto transition-all duration-fast active:scale-[.98] active:opacity-[.88]' : 'pointer-events-none'
        }`}
      >
        {/*
          O PONTO MUDA DE COR quando a origem é manual: azul é "é você, pelo
          GPS"; âmbar é "isto foi digitado". Cor sozinha não basta, e por isso o
          subtítulo também troca — mas o ponto é o que se nota de relance.
        */}
        <span
          className={`h-[9px] w-[9px] shrink-0 rounded-pill ${
            isManualOrigin ? 'bg-warning-500' : 'bg-brand-500'
          } ${isLocating && !isManualOrigin ? 'animate-pulse' : ''}`}
        />
        <div className="min-w-0">
          <p className="truncate text-[17px] font-extrabold leading-tight text-content-primary">
            {currentStreet ?? (isLocating ? 'Localizando…' : 'Sua localização')}
          </p>
          {isManualOrigin ? (
            <p className="truncate text-[13px] font-bold leading-tight text-warning-text">
              Partida definida por você
            </p>
          ) : (
            currentArea && (
              <p className="truncate text-[13px] font-semibold leading-tight text-content-secondary">{currentArea}</p>
            )
          )}
        </div>
      </Bloco>

      <button
        type="button"
        onClick={onProfileClick}
        aria-label="Perfil"
        className="pointer-events-auto relative flex h-[42px] w-[42px] shrink-0 items-center justify-center overflow-hidden rounded-pill bg-surface-card text-content-secondary shadow-float transition-all duration-fast ease-standard active:scale-[.97] active:opacity-[.88]"
      >
        {/*
          `object-cover` + `overflow-hidden` no botão: a foto já vem recortada
          em quadrado (ver services/avatar.ts), e estes dois garantem que ela
          preencha o círculo sem distorcer, qualquer que seja o formato que o
          usuário escolheu. Sem foto, o ícone padrão de sempre.
        */}
        {avatarDataUrl ? (
          <img src={avatarDataUrl} alt="" aria-hidden="true" className="h-full w-full object-cover" />
        ) : (
          <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="3.6" />
            <path d="M4.8 20a7.6 7.6 0 0 1 14.4 0" />
          </svg>
        )}
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
