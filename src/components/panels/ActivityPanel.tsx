import { Panel } from '@/components/panels/Panel'
import { ListRow, SectionLabel } from '@/components/ui/primitives'
import { listActivity, type ActivityEntry } from '@/services/storage/activityHistory'
import { formatDistance, formatEta } from '@/utils/geo'

interface ActivityPanelProps {
  onClose: () => void
  /**
   * Refaz o trajeto: recalcula a rota do zero com a posição e as regras
   * ATUAIS, em vez de reexibir uma rota antiga que pode estar desatualizada.
   */
  onRepeatTrip: (entry: ActivityEntry) => void
}

/**
 * Tela "Atividade" do handoff: corridas agrupadas por eyebrow de período,
 * cada uma com tile de ícone de rota, "Origem → Destino" e "1.8 km • 8 min".
 * O tile fica verde nas corridas recentes e neutro nas antigas.
 */
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

export function ActivityPanel({ onClose, onRepeatTrip }: ActivityPanelProps) {
  const entries = listActivity()
  const groups = groupEntries(entries)

  return (
    <Panel title="Atividade" onClose={onClose}>
      {entries.length === 0 ? (
        <p className="text-body text-content-secondary">
          Toda vez que você calcular uma rota, ela fica registrada neste histórico automaticamente.
        </p>
      ) : (
        <div className="flex flex-col gap-group">
          {groups.map((group) => (
            <div key={group.label}>
              <SectionLabel className="mb-stack">{group.label}</SectionLabel>
              <div className="flex flex-col gap-stack">
                {group.entries.map((entry) => (
                  <ListRow
                    key={entry.id}
                    icon={<RouteIcon />}
                    // Verde nas recentes (hoje/ontem), neutro no histórico mais antigo — regra do handoff.
                    tone={group.label === 'Hoje' || group.label === 'Ontem' ? 'go' : 'neutral'}
                    title={`${entry.originLabel} → ${entry.destinationLabel}`}
                    subtitle={`${formatDistance(entry.distanceMeters)}  •  ${formatEta(entry.etaMinutes)}`}
                    chevron
                    // Registros antigos não têm coordenadas — nesses, a linha
                    // fica sem ação em vez de prometer algo que falharia.
                    onClick={entry.destinationPoint ? () => onRepeatTrip(entry) : undefined}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}

function RouteIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="M8.5 6H14a4 4 0 010 8H10a4 4 0 000 8h5.5" />
    </svg>
  )
}
