import { Icon } from '@/components/ui/Icon'

export type BottomNavTab = 'explore' | 'saved' | 'activity' | 'profile'

interface BottomNavBarProps {
  active: BottomNavTab
  onSelect: (tab: BottomNavTab) => void
  /** Dentro da doca: a superfície é do contêiner (ver `VehicleStatusBar.embedded`). */
  embedded?: boolean
}

const TABS: { key: BottomNavTab; label: string }[] = [
  { key: 'explore', label: 'Explorar' },
  { key: 'saved', label: 'Salvos' },
  { key: 'activity', label: 'Atividade' },
  { key: 'profile', label: 'Perfil' },
]

/**
 * Barra de abas flutuante (handoff §5.1 `TabBar`): raio 28px, cápsula
 * `#EAF4FB` na aba ativa, rótulo 11.5/700 (800 no ativo).
 *
 * Todos os quatro rótulos aparecem agora. Na versão anterior só o rótulo da
 * aba ativa era exibido, porque a 16px os quatro não cabiam em 393px. O
 * handoff fixa o rótulo de tab em 11.5px — nesse tamanho os quatro cabem com
 * folga, e a hierarquia passa a vir da cápsula e do peso, não de esconder
 * texto.
 */
export function BottomNavBar({ active, onSelect, embedded = false }: BottomNavBarProps) {
  return (
    <div
      className={`pointer-events-auto flex items-center gap-1 p-2 ${
        embedded ? '' : 'rounded-2xl border border-hairline/[.06] bg-surface-overlay shadow-float backdrop-blur-xl'
      }`}
    >
      {TABS.map((tab) => {
        const isActive = tab.key === active
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onSelect(tab.key)}
            aria-current={isActive ? 'page' : undefined}
            className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-xl py-2 transition-all duration-base ease-standard active:scale-[.97] ${
              isActive ? 'bg-surface-tile-accent ring-1 ring-brand-500/20' : ''
            }`}
          >
            <span className={isActive ? 'text-brand-500' : 'text-content-tertiary'}>
              <Icon name={tab.key} active={isActive} size={24} />
            </span>
            <span
              className={`text-tab-label ${isActive ? 'font-extrabold text-brand-500' : 'text-content-tertiary'}`}
            >
              {tab.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
