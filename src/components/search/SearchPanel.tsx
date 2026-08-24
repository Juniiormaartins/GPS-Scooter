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
 * Barra flutuante origem → destino sobre o mapa (RouteSearchField do handoff):
 * avatar 44px à esquerda, duas linhas separadas por hairline — origem em
 * 16px/600 secundário e destino em 19px/800 primário — e a lupa azul à direita.
 *
 * Superfície translúcida com blur (`surface-overlay`) e raio 28px, porque é
 * chrome flutuando sobre o mapa; a regra do handoff é que só esse tipo de
 * elemento usa sombra e blur.
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
    <div className="pointer-events-auto rounded-2xl border border-white/10 bg-surface-card/[.86] px-card py-3 shadow-float backdrop-blur-xl">
      <div className="flex items-center gap-3.5">
        <button
          type="button"
          onClick={onProfileClick}
          aria-label="Perfil"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-brand-500/[.16] text-brand-500 transition-all duration-fast active:scale-[.97] active:opacity-[.88]"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="8" r="3.2" />
            <path d="M5 20c1.2-3.6 4.2-5.5 7-5.5s5.8 1.9 7 5.5" strokeLinecap="round" />
          </svg>
        </button>

        <div className="min-w-0 flex-1">
          <div className="border-b border-white/10 pb-2">
            <AddressAutocompleteInput
              value={originText}
              onChangeText={onOriginChange}
              onSelect={onSelectOrigin}
              placeholder="Sua localização"
              variant="secondary"
              leftIcon={<span className="h-[9px] w-[9px] shrink-0 rounded-pill bg-brand-500" />}
              rightAdornment={
                <button
                  type="button"
                  onClick={onUseCurrentLocation}
                  aria-label="Usar localização atual"
                  className="shrink-0 p-1 text-content-tertiary transition-colors active:text-brand-500"
                >
                  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 2v3M12 19v3M22 12h-3M5 12H2" strokeLinecap="round" />
                  </svg>
                </button>
              }
            />
          </div>

          <div className="pt-2">
            <AddressAutocompleteInput
              value={destinationText}
              onChangeText={onDestinationChange}
              onSelect={onSelectDestination}
              placeholder="Para onde?"
              variant="primary"
              leftIcon={<span className="h-[9px] w-[9px] shrink-0 rounded-pill bg-content-tertiary" />}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={onCalculateRoute}
          disabled={!canCalculate || isCalculating}
          aria-label="Calcular rota"
          className="shrink-0 p-1 text-brand-500 transition-all duration-fast active:scale-[.97] active:opacity-[.88] disabled:text-content-tertiary"
        >
          {isCalculating ? (
            <span className="block h-[26px] w-[26px] animate-spin rounded-pill border-[2.5px] border-brand-500 border-t-transparent" />
          ) : (
            <svg viewBox="0 0 24 24" className="h-[26px] w-[26px]" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>

      {warningMessage && (
        <p className="mt-2.5 rounded-md bg-warning-500/[.16] px-3 py-2 text-caption font-semibold text-warning-500">
          {warningMessage}
        </p>
      )}
    </div>
  )
}
