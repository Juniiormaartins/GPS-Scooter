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
 * Card único de busca, replicando o protótipo: avatar (acesso ao Perfil) à
 * esquerda, duas linhas de texto empilhadas — "Sua localização" (secundária,
 * menor) e "Para onde?" (principal, maior e em negrito) — separadas por uma
 * linha fina, e a lupa à direita. Não há barra de topo separada nem caixas
 * de input com fundo próprio: os campos são texto direto sobre o card.
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
    <div className="pointer-events-auto rounded-3xl border border-white/5 bg-surface-card/95 px-4 py-3 shadow-floating backdrop-blur">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onProfileClick}
          aria-label="Perfil"
          className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-500/15 text-brand-400 active:bg-brand-500/25"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="8" r="3.2" />
            <path d="M5 20c1.2-3.6 4.2-5.5 7-5.5s5.8 1.9 7 5.5" strokeLinecap="round" />
          </svg>
        </button>

        <div className="min-w-0 flex-1">
          <AddressAutocompleteInput
            value={originText}
            onChangeText={onOriginChange}
            onSelect={onSelectOrigin}
            placeholder="Sua localização"
            variant="secondary"
            leftIcon={<span className="h-2 w-2 shrink-0 rounded-full bg-brand-400" />}
            rightAdornment={
              <button
                type="button"
                onClick={onUseCurrentLocation}
                aria-label="Usar localização atual"
                className="shrink-0 rounded-full p-1 text-slate-500 active:text-brand-400"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 2v3M12 19v3M22 12h-3M5 12H2" strokeLinecap="round" />
                </svg>
              </button>
            }
          />

          <div className="my-1 h-px bg-white/10" />

          <AddressAutocompleteInput
            value={destinationText}
            onChangeText={onDestinationChange}
            onSelect={onSelectDestination}
            placeholder="Para onde?"
            variant="primary"
            leftIcon={<span className="h-2 w-2 shrink-0 rounded-full bg-slate-500" />}
          />
        </div>

        <button
          type="button"
          onClick={onCalculateRoute}
          disabled={!canCalculate || isCalculating}
          aria-label="Calcular rota"
          className="shrink-0 rounded-full p-2 text-brand-400 transition active:scale-95 active:bg-brand-500/15 disabled:text-slate-600"
        >
          {isCalculating ? (
            <span className="block h-6 w-6 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
          ) : (
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.4}>
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>

      {warningMessage && (
        <p className="mt-2 rounded-xl bg-warning-500/10 px-3 py-2 text-xs font-medium text-warning-400">{warningMessage}</p>
      )}
    </div>
  )
}
