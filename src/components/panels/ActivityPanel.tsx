import { Panel } from '@/components/panels/Panel'
import { listActivity, type ActivityEntry } from '@/services/storage/activityHistory'
import { formatDistance, formatEta } from '@/utils/geo'

interface ActivityPanelProps {
  onClose: () => void
}

/** Agrupamento por período — mesma lógica do protótipo (HOJE/ONTEM/ESTA SEMANA/ANTERIORES), a partir de datas reais. */
function groupLabel(timestamp: number): string {
  const date = new Date(timestamp)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const weekAgo = new Date(today)
  weekAgo.setDate(today.getDate() - 7)

  const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  if (isSameDay(date, today)) return 'Hoje'
  if (isSameDay(date, yesterday)) return 'Ontem'
  if (date >= weekAgo) return 'Esta semana'
  return 'Anteriores'
}

function groupEntries(entries: ActivityEntry[]): { label: string; entries: ActivityEntry[] }[] {
  const groups: { label: string; entries: ActivityEntry[] }[] = []
  for (const entry of entries) {
    const label = groupLabel(entry.timestamp)
    const current = groups[groups.length - 1]
    if (current?.label === label) current.entries.push(entry)
    else groups.push({ label, entries: [entry] })
  }
  return groups
}

function scoreDotClass(score: number): string {
  if (score >= 70) return 'text-success-400 bg-success-500/15'
  if (score >= 40) return 'text-warning-400 bg-warning-500/15'
  return 'text-danger-400 bg-danger-500/15'
}

export function ActivityPanel({ onClose }: ActivityPanelProps) {
  const entries = listActivity()
  const groups = groupEntries(entries)

  return (
    <Panel title="Atividade" onClose={onClose}>
      {entries.length === 0 ? (
        <div className="mt-10 flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-500/15 text-brand-400">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3.5 2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <p className="mt-4 text-sm font-semibold text-slate-100">Suas rotas aparecerão aqui</p>
          <p className="mt-1 max-w-[240px] text-sm text-slate-500">
            Toda vez que você calcular uma rota, ela fica registrada neste histórico automaticamente.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 rounded-full bg-brand-500 px-4 py-2.5 text-sm font-bold text-surface active:bg-brand-400"
          >
            Pesquisar um destino
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <div key={group.label}>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">{group.label}</h3>
              <div className="flex flex-col gap-2">
                {group.entries.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-surface-raised p-3">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${scoreDotClass(entry.suitabilityScore)}`}>
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
                        <circle cx="6" cy="6" r="2.2" />
                        <circle cx="18" cy="18" r="2.2" />
                        <path d="M8 6h5a3 3 0 013 3v0a3 3 0 01-3 3H8" strokeLinecap="round" />
                      </svg>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-100">
                        {entry.originLabel} → {entry.destinationLabel}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {formatDistance(entry.distanceMeters)} · {formatEta(entry.etaMinutes)} · {entry.suitabilityScore}/100
                      </p>
                    </div>
                    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-slate-600" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}
