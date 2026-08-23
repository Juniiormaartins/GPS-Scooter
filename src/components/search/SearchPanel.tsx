import { AddressAutocompleteInput } from '@/components/search/AddressAutocompleteInput'
import type { GeocodingResult } from '@/services/geocoding'

interface SearchPanelProps {
  originText: string
  destinationText: string
  onOriginChange: (value: string) => void
  onDestinationChange: (value: string) => void
  onSelectOrigin: (result: GeocodingResult) => void
  onSelectDestination: (result: GeocodingResult) => void
  onUseCurrentLocation: () => void
  onCalculateRoute: () => void
  onProfileClick: () => void
  isCalculating: boolean
  canCalculate: boolean
  warningMessage: string | null
}

/**
 * Card único de busca — sem barra de topo separada (o avatar/acesso ao
 * Perfil vive aqui dentro, à esquerda, como no protótipo). "Sua localização"
 * e "Para onde?" ficam empilhados com um marcador colorido cada, ligados por
 * uma linha vertical fina.
 */
export function SearchPanel({
  originText,
  destinationText,
  onOriginChange,
  onDestinationChange,
  onSelectOrigin,
  onSelectDestination,
  onUseCurrentLocation,
  onCalculateRoute,
  onProfileClick,
  isCalculating,
  canCalculate,
  warningMessage,
}: SearchPanelProps) {
  return (
    <div className="pointer-events-auto rounded-3xl border border-white/5 bg-surface-card/95 p-3 shadow-floating backdrop-blur">
      <div className="flex items-stretch gap-3">
        <button
          type="button"
          onClick={onProfileClick}
          aria-label="Perfil"
          className="flex h-11 w-11 shrink-0 items-center justify-center self-center overflow-hidden rounded-full bg-brand-500/15 text-brand-400 active:bg-brand-500/25"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="8" r="3.2" />
            <path d="M5 20c1.2-3.6 4.2-5.5 7-5.5s5.8 1.9 7 5.5" strokeLinecap="round" />
          </svg>
        </button>

        <div className="flex flex-col items-center justify-between py-1">
          <span className="h-2 w-2 shrink-0 rounded-full bg-brand-400" />
          <span className="my-1 w-px flex-1 border-l border-dashed border-white/15" />
          <span className="h-2 w-2 shrink-0 rounded-full bg-slate-500" />
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <AddressAutocompleteInput
            value={originText}
            onChangeText={onOriginChange}
            onSelect={onSelectOrigin}
            placeholder="Sua localização"
            rightAdornment={
              <button
                type="button"
                onClick={onUseCurrentLocation}
                className="shrink-0 rounded-full bg-brand-500 px-2.5 py-1 text-xs font-semibold text-surface active:bg-brand-400"
              >
                Atual
              </button>
            }
          />

          <AddressAutocompleteInput
            value={destinationText}
            onChangeText={onDestinationChange}
            onSelect={onSelectDestination}
            placeholder="Para onde?"
            rightAdornment={
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-brand-400" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
              </svg>
            }
          />
        </div>
      </div>

      {warningMessage && (
        <p className="mt-2 rounded-xl bg-warning-500/10 px-3 py-2 text-xs font-medium text-warning-400">{warningMessage}</p>
      )}

      <button
        type="button"
        onClick={onCalculateRoute}
        disabled={!canCalculate || isCalculating}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-success-500 py-3.5 text-[15px] font-bold text-surface shadow-sm transition active:scale-[0.99] active:bg-success-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2}>
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
        </svg>
        {isCalculating ? 'Calculando rota…' : 'Calcular rota'}
      </button>
    </div>
  )
}
