import { useState } from 'react'
import { Panel } from '@/components/panels/Panel'
import { ListRow, SectionLabel } from '@/components/ui/primitives'
import { listSavedPlaces, removeSavedPlace, type SavedPlace } from '@/services/storage/savedPlaces'

interface SavedPanelProps {
  onClose: () => void
  onTraceRoute: (place: SavedPlace) => void
}

/**
 * Tela "Salvos" do handoff: dois atalhos lado a lado (Casa / Trabalho) e,
 * abaixo, a lista de favoritos com estrela âmbar e chevron.
 *
 * Estado vazio segue a regra do handoff — o rótulo de ação toma o lugar do
 * valor ("Definir endereço"), sem ilustração de vazio.
 */
export function SavedPanel({ onClose, onTraceRoute }: SavedPanelProps) {
  const [places, setPlaces] = useState(listSavedPlaces())

  function handleRemove(id: string) {
    removeSavedPlace(id)
    setPlaces(listSavedPlaces())
  }

  const home = places.find((place) => place.kind === 'home')
  const work = places.find((place) => place.kind === 'work')
  const favorites = places.filter((place) => place.kind === 'favorite')

  return (
    <Panel title="Salvos" onClose={onClose}>
      <div className="grid grid-cols-2 gap-stack">
        <QuickSlot kind="home" place={home} onTraceRoute={onTraceRoute} />
        <QuickSlot kind="work" place={work} onTraceRoute={onTraceRoute} />
      </div>

      <SectionLabel className="mb-stack mt-group">Locais favoritos</SectionLabel>

      {favorites.length === 0 ? (
        <p className="text-body text-content-secondary">
          Pesquise um destino, abra a ficha do local e toque em "Salvar" para adicionar um favorito aqui.
        </p>
      ) : (
        <div className="flex flex-col gap-stack">
          {favorites.map((place) => (
            <div key={place.id} className="relative">
              <ListRow
                icon={<StarIcon />}
                tone="warn"
                title={place.label}
                subtitle={place.secondaryLabel}
                chevron
                onClick={() => onTraceRoute(place)}
              />
              <button
                type="button"
                onClick={() => handleRemove(place.id)}
                aria-label={`Remover ${place.label}`}
                className="absolute right-11 top-1/2 -translate-y-1/2 p-2 text-content-tertiary transition-all duration-fast active:scale-[.97] active:text-danger-500"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}

/** Atalho Casa/Trabalho — ícone azul, rótulo 17/700 e o endereço (ou a ação de definir) abaixo. */
function QuickSlot({
  kind,
  place,
  onTraceRoute,
}: {
  kind: 'home' | 'work'
  place: SavedPlace | undefined
  onTraceRoute: (place: SavedPlace) => void
}) {
  const label = kind === 'home' ? 'Casa' : 'Trabalho'

  return (
    <button
      type="button"
      onClick={() => place && onTraceRoute(place)}
      disabled={!place}
      className="flex flex-col items-start gap-2.5 rounded-xl border border-hairline/10 bg-surface-card p-card text-left transition-all duration-fast ease-standard active:scale-[.97] active:opacity-[.88] disabled:active:scale-100"
    >
      <span className="text-brand-500">{kind === 'home' ? <HomeIcon /> : <WorkIcon />}</span>
      <span className="w-full">
        <span className="block text-row-title text-content-primary">{label}</span>
        <span className={`mt-0.5 block truncate text-[14px] ${place ? 'text-content-secondary' : 'text-brand-500'}`}>
          {place ? place.label : 'Definir endereço'}
        </span>
      </span>
    </button>
  )
}

const ICON = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" {...ICON}>
      <path d="M4 11l8-7 8 7v9a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1v-9z" />
    </svg>
  )
}

function WorkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" {...ICON}>
      <rect x="3" y="7" width="18" height="13" rx="1.5" />
      <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  )
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" {...ICON}>
      <path d="M12 3l2.6 5.8 6.4.6-4.8 4.3 1.4 6.3L12 16.9l-5.6 3.1 1.4-6.3-4.8-4.3 6.4-.6L12 3z" />
    </svg>
  )
}
