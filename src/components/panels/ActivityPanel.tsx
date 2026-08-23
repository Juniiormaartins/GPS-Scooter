import { Panel } from '@/components/panels/Panel'
import { listActivity } from '@/services/storage/activityHistory'
import { formatDistance, formatEta } from '@/utils/geo'

interface ActivityPanelProps {
  onClose: () => void
}

function formatRelativeDay(timestamp: number): string {
  const date = new Date(timestamp)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  if (isSameDay(date, today)) return 'Hoje'
  if (isSameDay(date, yesterday)) return 'Ontem'
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function scoreDotClass(score: number): string {
  if (score >= 70) return 'bg-success-500'
  if (score >= 40) return 'bg-amber-500'
  return 'bg-red-500'
}

export function ActivityPanel({ onClose }: ActivityPanelProps) {
  const entries = listActivity()

  return (
    <Panel title="Atividade" onClose={onClose}>
      {entries.length === 0 ? (
        <div className="mt-10 flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3.5 2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <p className="mt-4 text-sm font-semibold text-navy-900">Suas rotas aparecerão aqui</p>
          <p className="mt-1 max-w-[240px] text-sm text-slate-500">
            Toda vez que você calcular uma rota, ela fica registrada neste histórico automaticamente.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 rounded-full bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white active:bg-brand-700"
          >
            Pesquisar um destino
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-start gap-3 rounded-2xl border border-slate-200 p-3">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${scoreDotClass(entry.suitabilityScore)}`} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-400">{formatRelativeDay(entry.timestamp)}</p>
                <p className="mt-0.5 truncate text-sm font-bold text-navy-900">
                  {entry.originLabel} → {entry.destinationLabel}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {formatDistance(entry.distanceMeters)} · {formatEta(entry.etaMinutes)} · {entry.suitabilityScore}/100
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}
