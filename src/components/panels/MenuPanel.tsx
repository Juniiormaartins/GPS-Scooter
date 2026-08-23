import { Panel } from '@/components/panels/Panel'

export type MenuTarget = 'profile' | 'saved' | 'activity'

interface MenuPanelProps {
  onClose: () => void
  onNavigate: (target: MenuTarget) => void
}

const ITEMS: { key: MenuTarget; label: string; description: string }[] = [
  { key: 'profile', label: 'Meu veículo', description: 'Velocidade, autonomia e preferências de rota' },
  { key: 'saved', label: 'Salvos', description: 'Casa, trabalho e favoritos' },
  { key: 'activity', label: 'Atividade', description: 'Histórico de rotas calculadas' },
]

export function MenuPanel({ onClose, onNavigate }: MenuPanelProps) {
  return (
    <Panel title="Menu" onClose={onClose}>
      <div className="flex flex-col gap-1">
        {ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onNavigate(item.key)}
            className="flex items-center gap-3 rounded-2xl px-3 py-3.5 text-left active:bg-slate-50"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <MenuIcon itemKey={item.key} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-navy-900">{item.label}</span>
              <span className="block truncate text-xs text-slate-500">{item.description}</span>
            </span>
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-slate-300" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ))}
      </div>

      <div className="mt-6 border-t border-slate-100 pt-4">
        <p className="text-xs text-slate-400">GPS Scooter · navegação para mobilidade elétrica urbana</p>
      </div>
    </Panel>
  )
}

function MenuIcon({ itemKey }: { itemKey: MenuTarget }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

  if (itemKey === 'profile') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" {...common}>
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5 20c1.2-3.6 4.2-5.5 7-5.5s5.8 1.9 7 5.5" />
      </svg>
    )
  }
  if (itemKey === 'saved') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" {...common}>
        <path d="M6 3h12v18l-6-4-6 4V3z" strokeLinejoin="round" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  )
}
