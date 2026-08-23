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
  isCalculating: boolean
  canCalculate: boolean
  warningMessage: string | null
}

export function SearchPanel({
  originText,
  destinationText,
  onOriginChange,
  onDestinationChange,
  onSelectOrigin,
  onSelectDestination,
  onUseCurrentLocation,
  onCalculateRoute,
  isCalculating,
  canCalculate,
  warningMessage,
}: SearchPanelProps) {
  return (
    <div className="pointer-events-auto rounded-3xl bg-white/95 p-3 shadow-floating backdrop-blur">
      <div className="flex items-stretch gap-3">
        <div className="flex flex-col items-center justify-between py-2.5">
          <span className="h-2.5 w-2.5 rounded-full border-2 border-brand-600 bg-white" />
          <span className="my-1 h-8 w-px flex-1 border-l border-dashed border-slate-300" />
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-navy-900" fill="currentColor">
            <path d="M12 2C7.6 2 4 5.6 4 10c0 5.4 7 11.5 7.3 11.8.4.3 1 .3 1.4 0C13 21.5 20 15.4 20 10c0-4.4-3.6-8-8-8zm0 11a3 3 0 110-6 3 3 0 010 6z" />
          </svg>
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
                className="shrink-0 rounded-full bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white active:bg-brand-700"
              >
                Atual
              </button>
            }
          />

          <AddressAutocompleteInput
            value={destinationText}
            onChangeText={onDestinationChange}
            onSelect={onSelectDestination}
            placeholder="Para onde vamos?"
            leftIcon={
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-brand-500" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
              </svg>
            }
          />
        </div>
      </div>

      {warningMessage && (
        <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">{warningMessage}</p>
      )}

      <button
        type="button"
        onClick={onCalculateRoute}
        disabled={!canCalculate || isCalculating}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 py-3.5 text-[15px] font-semibold text-white shadow-sm transition active:scale-[0.99] active:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
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
