import { useState } from 'react'
import { Panel } from '@/components/panels/Panel'
import { listSavedPlaces, removeSavedPlace, type SavedPlace } from '@/services/storage/savedPlaces'

interface SavedPanelProps {
  onClose: () => void
  onTraceRoute: (place: SavedPlace) => void
}

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
      <div className="grid grid-cols-2 gap-2">
        <QuickSlotCard kind="home" place={home} onTraceRoute={onTraceRoute} />
        <QuickSlotCard kind="work" place={work} onTraceRoute={onTraceRoute} />
      </div>

      <h3 className="mb-2 mt-6 text-xs font-bold uppercase tracking-wide text-slate-400">Locais favoritos</h3>

      {favorites.length === 0 ? (
        <div className="mt-4 flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-500/15 text-brand-400">
            <KindIcon kind="favorite" />
          </span>
          <p className="mt-4 text-sm font-semibold text-slate-100">Nenhum favorito ainda</p>
          <p className="mt-1 max-w-[240px] text-sm text-slate-500">
            Pesquise um destino, abra a ficha do local e toque em "Salvar" para adicionar um favorito aqui.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {favorites.map((place) => (
            <div key={place.id} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-surface-raised p-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning-500/15 text-warning-400">
                <KindIcon kind="favorite" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-100">{place.label}</p>
                {place.secondaryLabel && <p className="truncate text-xs text-slate-500">{place.secondaryLabel}</p>}
              </div>
              <button
                type="button"
                onClick={() => onTraceRoute(place)}
                aria-label="Traçar rota"
                className="shrink-0 rounded-full bg-brand-500/15 p-2 text-brand-400 active:bg-brand-500/25"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4}>
                  <circle cx="6" cy="6" r="2.4" />
                  <circle cx="18" cy="18" r="2.4" />
                  <path d="M8 7h5a3 3 0 013 3v0a3 3 0 01-3 3H8" strokeLinecap="round" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => handleRemove(place.id)}
                aria-label="Remover"
                className="shrink-0 text-slate-600 active:text-danger-400"
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

function QuickSlotCard({
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
      className="flex flex-col items-start gap-2 rounded-2xl border border-white/5 bg-surface-raised p-3.5 text-left disabled:opacity-70"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500/15 text-brand-400">
        <KindIcon kind={kind} />
      </span>
      <span className="text-sm font-bold text-slate-100">{label}</span>
      <span className="truncate text-xs text-slate-500">
        {place ? place.label : 'Ainda não configurado'}
      </span>
    </button>
  )
}

function KindIcon({ kind }: { kind: SavedPlace['kind'] }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

  if (kind === 'home') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" {...common}>
        <path d="M4 11l8-7 8 7v9a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1v-9z" />
      </svg>
    )
  }
  if (kind === 'work') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" {...common}>
        <rect x="3" y="7" width="18" height="13" rx="1.5" />
        <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...common}>
      <path d="M12 3l2.6 5.8 6.4.6-4.8 4.3 1.4 6.3L12 16.9l-5.6 3.1 1.4-6.3-4.8-4.3 6.4-.6L12 3z" strokeLinejoin="round" />
    </svg>
  )
}
