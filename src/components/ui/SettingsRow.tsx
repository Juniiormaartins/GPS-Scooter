import type { ReactNode } from 'react'

/**
 * Linha de preferência com controle à direita — contrato de
 * design/gps-scooter-ui/components/forms/SettingsRow.
 * `tone="danger"` centraliza o rótulo e o pinta de vermelho (Sair da Conta).
 */
export function SettingsRow({
  label,
  description,
  icon,
  control = 'none',
  checked = false,
  value,
  action,
  tone = 'default',
  inGroup = false,
  expanded,
  onChange,
  onClick,
}: {
  label: string
  /**
   * Segunda linha, abaixo do rótulo.
   *
   * Existe para que a explicação de uma opção fique DENTRO dela. Antes as
   * descrições eram parágrafos soltos entre as linhas, o que dobrava a altura
   * da lista e desconectava visualmente o texto do controle que ele explica.
   */
  description?: string
  icon?: ReactNode
  control?: 'toggle' | 'value' | 'action' | 'chevron' | 'none'
  checked?: boolean
  value?: string
  action?: string
  tone?: 'default' | 'danger'
  /**
   * A linha vive dentro de um `SettingsGroup` e abre mão do próprio cartão.
   *
   * Sem isto, cada preferência era um cartão flutuante e a tela virava uma
   * pilha de retângulos sem relação entre si. Em grupo, o cartão é do GRUPO e
   * as linhas se separam por divisória — que é o que comunica "estas opções
   * são da mesma coisa".
   */
  inGroup?: boolean
  /** Para linhas que abrem uma lista: gira o chevron e anuncia o estado. */
  expanded?: boolean
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
      {...(interactive && expanded != null ? { 'aria-expanded': expanded } : {})}
      className={`flex min-h-[64px] w-full items-center gap-3.5 px-card py-3 text-left ${
        inGroup ? '' : 'rounded-xl border border-hairline/10 bg-surface-card'
      } ${
        // Em grupo o "apertar" é opacidade, não escala: encolher uma linha
        // dentro de um cartão dividido descola a divisória e pisca.
        interactive
          ? inGroup
            ? 'transition-all duration-fast ease-standard active:bg-hairline/5'
            : 'transition-all duration-fast ease-standard active:scale-[.97] active:opacity-[.88]'
          : ''
      }`}
    >
      {icon && <span className="shrink-0 text-brand-500">{icon}</span>}
      <span className="min-w-0 flex-1">
        {/*
          O rótulo QUEBRA em vez de truncar. Truncar servia quando a linha era
          só título + valor; com descrição, "Evitar vias expressas e rodovias"
          virava "Evitar vias expressas e rod…" — cortando justamente a palavra
          que distingue a opção da vizinha. O controle é `shrink-0`, então
          quebrar não o empurra para fora.
        */}
        <span className="block break-words text-row-title text-content-primary">{label}</span>
        {description && <span className="mt-0.5 block text-caption text-content-tertiary">{description}</span>}
      </span>

      {control === 'toggle' && <Toggle checked={checked} onChange={onChange} label={label} />}
      {control === 'value' && value && <span className="shrink-0 text-body text-content-secondary">{value}</span>}
      {control === 'action' && action && <span className="shrink-0 text-[15px] font-bold text-brand-500">{action}</span>}
      {control === 'chevron' && (
        <svg
          viewBox="0 0 24 24"
          className={`h-5 w-5 shrink-0 text-content-tertiary transition-transform duration-fast ${
            expanded ? 'rotate-90' : ''
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
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
      {/* Botão do toggle sempre branco: ele é o elemento que se move sobre o
          trilho, e a leitura de estado vem da COR DO TRILHO, não da bolinha.
          Antes o estado desligado usava um cinza-claro fixo, que no tema
          escuro brigava com o trilho e no claro sumia nele. */}
      <span className="h-7 w-7 rounded-pill bg-white shadow-tile transition-all duration-base" />
    </button>
  )
}
