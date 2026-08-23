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

/** Navegação inferior flutuante — pílula com margem das bordas, não uma barra colada de ponta a ponta (ver protótipo). */
export function BottomNavBar({ active, onSelect }: BottomNavBarProps) {
  return (
    <div className="pointer-events-auto flex items-center justify-around gap-1 rounded-full border border-white/5 bg-surface-card/95 px-2 py-2 shadow-floating backdrop-blur">
      {TABS.map((tab) => {
        const isActive = tab.key === active
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onSelect(tab.key)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 text-[13px] font-bold transition-colors ${
              isActive ? 'bg-brand-500/15 text-brand-400' : 'text-slate-500'
            }`}
          >
            <TabIcon tabKey={tab.key} active={isActive} />
            <span className={isActive ? 'inline' : 'hidden'}>{tab.label}</span>
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
      <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" {...common}>
        <path d="M12 2C7.6 2 4 5.6 4 10c0 5.4 7 11.5 7.3 11.8.4.3 1 .3 1.4 0C13 21.5 20 15.4 20 10c0-4.4-3.6-8-8-8zm0 11a3 3 0 110-6 3 3 0 010 6z" fill={active ? 'currentColor' : 'none'} />
      </svg>
    )
  }
  if (tabKey === 'saved') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" {...common}>
        <path
          d="M12 17.3l-5.4 3 1-6-4.4-4.3 6.1-.9L12 3.5l2.7 5.6 6.1.9-4.4 4.3 1 6z"
          fill={active ? 'currentColor' : 'none'}
        />
      </svg>
    )
  }
  if (tabKey === 'activity') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" {...common}>
      <circle cx="12" cy="8" r="3.2" fill={active ? 'currentColor' : 'none'} />
      <path d="M5 20c1.2-3.6 4.2-5.5 7-5.5s5.8 1.9 7 5.5" />
    </svg>
  )
}
