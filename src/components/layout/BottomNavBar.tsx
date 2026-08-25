export type BottomNavTab = 'explore' | 'saved' | 'activity' | 'profile'

interface BottomNavBarProps {
  active: BottomNavTab
  onSelect: (tab: BottomNavTab) => void
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
export function BottomNavBar({ active, onSelect }: BottomNavBarProps) {
  return (
    <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-hairline/[.06] bg-surface-overlay p-2 shadow-float backdrop-blur-xl">
      {TABS.map((tab) => {
        const isActive = tab.key === active
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onSelect(tab.key)}
            aria-current={isActive ? 'page' : undefined}
            className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-xl py-2 transition-all duration-base ease-standard active:scale-[.97] ${
              isActive ? 'bg-surface-tile-accent' : ''
            }`}
          >
            <span className={isActive ? 'text-brand-500' : 'text-content-tertiary'}>
              <TabIcon tabKey={tab.key} active={isActive} />
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

function TabIcon({ tabKey, active }: { tabKey: BottomNavTab; active: boolean }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

  if (tabKey === 'explore') {
    return (
      <svg viewBox="0 0 24 24" className="h-[22px] w-[22px] shrink-0" {...common}>
        <path d="M9 3L3 5.5v16L9 19l6 2.5 6-2.5v-16L15 5.5 9 3z" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.18 : 0} />
        <path d="M9 3v16M15 5.5v16" />
      </svg>
    )
  }
  if (tabKey === 'saved') {
    return (
      <svg viewBox="0 0 24 24" className="h-[22px] w-[22px] shrink-0" {...common}>
        <path d="M12 17.3l-5.4 3 1-6-4.4-4.3 6.1-.9L12 3.5l2.7 5.6 6.1.9-4.4 4.3 1 6z" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.18 : 0} />
      </svg>
    )
  }
  if (tabKey === 'activity') {
    return (
      <svg viewBox="0 0 24 24" className="h-[22px] w-[22px] shrink-0" {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className="h-[22px] w-[22px] shrink-0" {...common}>
      <circle cx="12" cy="8" r="3.4" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.18 : 0} />
      <path d="M5 20c1.2-3.6 4.2-5.5 7-5.5s5.8 1.9 7 5.5" />
    </svg>
  )
}
