import { Panel } from '@/components/panels/Panel'
import { ListRow, SectionLabel } from '@/components/ui/primitives'
import { listActivity, type ActivityEntry } from '@/services/storage/activityHistory'
import {
  describeFrequentPlace,
  frequentPlaces,
  lastTrip,
  routineTrips,
} from '@/services/storage/travelPatterns'
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

  /*
    PADRÕES ANTES DA CRONOLOGIA.

    A lista por data responde "o que eu fiz"; os padrões respondem "para onde eu
    vou de novo", que é o motivo real de alguém abrir esta tela. Por isso os
    atalhos vêm primeiro e o histórico continua embaixo, inteiro — nada foi
    escondido, só reordenado por utilidade.

    Tudo aqui é derivado do MESMO histórico, na hora. Ver travelPatterns.
  */
  const ultimo = lastTrip(entries)
  const frequentes = frequentPlaces(entries).slice(0, 3)
  const rotinas = routineTrips(entries).slice(0, 2)
  const temPadroes = ultimo != null || frequentes.length > 0 || rotinas.length > 0

  return (
    <Panel title="Atividade" onClose={onClose}>
      {entries.length === 0 ? (
        <p className="text-body text-content-secondary">
          Toda vez que você calcular uma rota, ela fica registrada neste histórico automaticamente.
        </p>
      ) : (
        <div className="flex flex-col gap-group">
          {temPadroes && (
            <div>
              <SectionLabel className="mb-stack">Atalhos</SectionLabel>
              <div className="flex flex-col gap-2">
                {ultimo && (
                  <PatternRow
                    title="Refazer a última rota"
                    subtitle={ultimo.destinationLabel}
                    badge="Última"
                    onClick={() => onRepeatTrip(ultimo)}
                  />
                )}

                {rotinas.map((rotina) => (
                  <PatternRow
                    key={`rotina-${rotina.destinationLabel}-${rotina.lastAt}`}
                    title={rotina.destinationLabel}
                    subtitle={`Trajeto frequente · ${rotina.trips}× · ${formatDistance(rotina.distanceMeters)}`}
                    badge="Rotina"
                    onClick={() =>
                      onRepeatTrip({
                        ...entries[0],
                        originLabel: rotina.originLabel,
                        destinationLabel: rotina.destinationLabel,
                        originPoint: rotina.originPoint,
                        destinationPoint: rotina.destinationPoint,
                        distanceMeters: rotina.distanceMeters,
                      })
                    }
                  />
                ))}

                {frequentes
                  // Um lugar que já apareceu como rotina não vira card de novo:
                  // a rotina diz tudo que o lugar frequente diria, e mais.
                  .filter((lugar) => !rotinas.some((r) => r.destinationLabel === lugar.label))
                  .map((lugar) => (
                    <PatternRow
                      key={`frequente-${lugar.label}`}
                      title={lugar.label}
                      subtitle={`Você costuma ir aqui — ${describeFrequentPlace(lugar)}`}
                      badge="Frequente"
                      onClick={() =>
                        onRepeatTrip({
                          ...entries[0],
                          destinationLabel: lugar.label,
                          destinationPoint: lugar.point,
                          originPoint: undefined,
                        })
                      }
                    />
                  ))}
              </div>
            </div>
          )}

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

/**
 * Linha de atalho de padrão.
 *
 * Visualmente distinta das linhas do histórico (que usam `ListRow` com tile de
 * ícone): aqui o destaque é um selo de texto curto — "Última", "Rotina",
 * "Frequente" — porque o que diferencia estas linhas entre si não é a categoria
 * do lugar, é a RAZÃO de elas estarem ali. Um ícone de rota repetido quatro
 * vezes não diria nada.
 */
function PatternRow({
  title,
  subtitle,
  badge,
  onClick,
}: {
  title: string
  subtitle: string
  badge: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-hairline/[.08] bg-surface-card px-3.5 py-3 text-left transition-all duration-base active:scale-[.98]"
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="shrink-0 rounded-pill bg-brand-500/[.14] px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-brand-500">
            {badge}
          </span>
          <span className="truncate text-[15px] font-extrabold text-content-primary">{title}</span>
        </span>
        <span className="mt-0.5 block truncate text-[13px] font-semibold text-content-tertiary">{subtitle}</span>
      </span>
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-content-tertiary" fill="none" stroke="currentColor" strokeWidth={2.6}>
        <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
