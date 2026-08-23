export type BottomNavTab = 'explore' | 'saved' | 'activity' | 'profile'

interface BottomNavBarProps {
  active: BottomNavTab
  onSelect: (tab: BottomNavTab) => void
}

const TABS: { key: BottomNavTab; label: string }[] = [
  { key: 'explore', label: 'Mapa' },
  { key: 'saved', label: 'Salvos' },
  { key: 'activity', label: 'Atividade' },
  { key: 'profile', label: 'Perfil' },
]

export function BottomNavBar({ active, onSelect }: BottomNavBarProps) {
  return (
    <div className="pointer-events-auto flex items-center justify-around rounded-t-2xl border-t border-white/5 bg-surface-card px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-floating">
      {TABS.map((tab) => {
        const isActive = tab.key === active
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onSelect(tab.key)}
            className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-semibold ${
              isActive ? 'text-brand-400' : 'text-slate-500'
            }`}
          >
            <TabIcon tabKey={tab.key} active={isActive} />
            {tab.label}
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
      <svg viewBox="0 0 24 24" className="h-5 w-5" {...common}>
        <path d="M12 2C7.6 2 4 5.6 4 10c0 5.4 7 11.5 7.3 11.8.4.3 1 .3 1.4 0C13 21.5 20 15.4 20 10c0-4.4-3.6-8-8-8zm0 11a3 3 0 110-6 3 3 0 010 6z" fill={active ? 'currentColor' : 'none'} />
      </svg>
    )
  }
  if (tabKey === 'saved') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" {...common}>
        <path
          d="M12 17.3l-5.4 3 1-6-4.4-4.3 6.1-.9L12 3.5l2.7 5.6 6.1.9-4.4 4.3 1 6z"
          fill={active ? 'currentColor' : 'none'}
        />
      </svg>
    )
  }
  if (tabKey === 'activity') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...common}>
      <circle cx="12" cy="8" r="3.2" fill={active ? 'currentColor' : 'none'} />
      <path d="M5 20c1.2-3.6 4.2-5.5 7-5.5s5.8 1.9 7 5.5" />
    </svg>
  )
}
