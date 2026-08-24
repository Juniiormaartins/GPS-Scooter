import { AddressAutocompleteInput } from '@/components/search/AddressAutocompleteInput'
import type { GeocodingResult } from '@/services/geocoding'

interface SearchPanelProps {
  originText: string
  destinationText: string
  onOriginChange: (value: string) => void
  onSelectOrigin: (result: GeocodingResult) => void
  onUseCurrentLocation: () => void
  /** Abre a tela de busca em tela cheia (SearchScreen) — o fluxo desenhado no handoff. */
  onOpenSearch: () => void
  onProfileClick: () => void
  isCalculating: boolean
  warningMessage: string | null
}

/**
 * Barra flutuante origem → destino sobre o mapa (RouteSearchField do handoff):
 * avatar à esquerda, duas linhas separadas por hairline e a lupa à direita.
 *
 * A linha de DESTINO não é um campo de digitação aqui — é um gatilho. Tocar
 * nela (ou na lupa) abre a tela de busca em tela cheia, que é onde o handoff
 * colocou a experiência de pesquisa (campo focado, categorias rápidas,
 * resultados). A origem continua editável em linha porque quase sempre é
 * "sua localização" e trocá-la é a exceção, não o fluxo principal.
 */
export function SearchPanel({
  originText,
  destinationText,
  onOriginChange,
  onSelectOrigin,
  onUseCurrentLocation,
  onOpenSearch,
  onProfileClick,
  isCalculating,
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

          <button
            type="button"
            onClick={onOpenSearch}
            className="flex w-full items-center gap-2.5 pt-2 text-left"
          >
            <span className="h-[9px] w-[9px] shrink-0 rounded-pill bg-content-tertiary" />
            <span
              className={`min-w-0 flex-1 truncate text-[19px] font-extrabold ${
                destinationText ? 'text-content-primary' : 'text-content-primary/90'
              }`}
            >
              {destinationText || 'Para onde?'}
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Pesquisar destino"
          className="shrink-0 p-1 text-brand-500 transition-all duration-fast active:scale-[.97] active:opacity-[.88]"
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
