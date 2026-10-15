import { Icon } from '@/components/ui/Icon'
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
        <div className="flex flex-col items-center rounded-xl border border-dashed border-hairline/[.18] px-6 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-pill bg-brand-500/[.14] text-brand-500">
            <Icon name="activity" size={24} active />
          </span>
          <p className="mt-3 text-row-title text-content-primary">Nenhuma rota ainda</p>
          <p className="mt-1 max-w-[260px] text-[14px] font-semibold leading-snug text-content-secondary">
            Toda rota que você calcular fica registrada aqui, e depois dá para refazer com um toque.
          </p>
        </div>
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
                    icon={<Icon name="route" size={24} />}
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
      <Icon name="chevron-right" size={16} className="shrink-0 text-content-tertiary" />
    </button>
  )
}
