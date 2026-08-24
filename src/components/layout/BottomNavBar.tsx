/** Três destinos, como no handoff — Perfil não fica aqui, é acessado pelo avatar do card de busca. */
export type BottomNavTab = 'explore' | 'saved' | 'activity'

interface BottomNavBarProps {
  active: BottomNavTab
  onSelect: (tab: BottomNavTab) => void
}

const TABS: { key: BottomNavTab; label: string }[] = [
  { key: 'explore', label: 'Explorar' },
  { key: 'saved', label: 'Salvos' },
  { key: 'activity', label: 'Atividade' },
]

/**
 * Barra de abas flutuante em pílula, ancorada acima do home indicator.
 * Contrato de design/gps-scooter-ui/components/navigation/TabBar: superfície
 * translúcida com blur, altura 52px por item, e a aba ativa recebendo cápsula
 * azul 16% + ícone azul + label branco.
 */
export function BottomNavBar({ active, onSelect }: BottomNavBarProps) {
  return (
    <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-white/10 bg-surface-card/[.86] p-1.5 shadow-float backdrop-blur-xl">
      {TABS.map((tab) => {
        const isActive = tab.key === active
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onSelect(tab.key)}
            className={`flex h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl text-[16px] font-bold transition-colors duration-base ease-standard ${
              isActive ? 'bg-brand-500/[.16] text-content-primary' : 'text-content-tertiary'
            }`}
          >
            <span className={isActive ? 'text-brand-500' : 'text-content-tertiary'}>
              <TabIcon tabKey={tab.key} active={isActive} />
            </span>
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
  return (
    <svg viewBox="0 0 24 24" className="h-[22px] w-[22px] shrink-0" {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  )
}
