import { useState } from 'react'
import { Panel } from '@/components/panels/Panel'
import { listSavedPlaces, removeSavedPlace, type SavedPlace } from '@/services/storage/savedPlaces'

interface SavedPanelProps {
  onClose: () => void
  onTraceRoute: (place: SavedPlace) => void
}

const KIND_LABEL: Record<SavedPlace['kind'], string> = { home: 'Casa', work: 'Trabalho', favorite: 'Favorito' }

export function SavedPanel({ onClose, onTraceRoute }: SavedPanelProps) {
  const [places, setPlaces] = useState(listSavedPlaces())

  function handleRemove(id: string) {
    removeSavedPlace(id)
    setPlaces(listSavedPlaces())
  }

  return (
    <Panel title="Salvos" onClose={onClose}>
      {places.length === 0 ? (
        <div className="mt-10 flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <KindIcon kind="favorite" />
          </span>
          <p className="mt-4 text-sm font-semibold text-navy-900">Nenhum lugar salvo ainda</p>
          <p className="mt-1 max-w-[240px] text-sm text-slate-500">
            Pesquise um destino, abra a ficha do local e toque em "Salvar" para adicionar Casa, Trabalho ou um favorito aqui.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {places.map((place) => (
            <div key={place.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                <KindIcon kind={place.kind} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-400">{KIND_LABEL[place.kind]}</p>
                <p className="truncate text-sm font-bold text-navy-900">{place.label}</p>
                {place.secondaryLabel && <p className="truncate text-xs text-slate-500">{place.secondaryLabel}</p>}
              </div>
              <button
                type="button"
                onClick={() => onTraceRoute(place)}
                className="shrink-0 rounded-full bg-brand-600 px-3 py-2 text-xs font-semibold text-white active:bg-brand-700"
              >
                Traçar rota
              </button>
              <button
                type="button"
                onClick={() => handleRemove(place.id)}
                aria-label="Remover"
                className="shrink-0 text-slate-300 active:text-red-500"
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
