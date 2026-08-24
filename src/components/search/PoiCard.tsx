import { Button } from '@/components/ui/Button'
import { Tag } from '@/components/ui/primitives'
import type { LngLat } from '@/config/region'
import type { GeocodingResult } from '@/services/geocoding'
import { formatDistance, haversineDistanceMeters } from '@/utils/geo'

interface PoiCardProps {
  poi: GeocodingResult
  onTraceRoute: () => void
  onSave: () => void
  onDismiss: () => void
  isSaved: boolean
  /** Posição atual — usada só para a distância real; sem ela o chip não aparece. */
  userPoint?: LngLat | null
}

/**
 * Ficha do local, no formato de bottom sheet do handoff: nome grande, linha
 * de categoria + distância, endereço, e as duas ações ("Traçar Rota" primária
 * azul, "Salvar" secundária).
 *
 * Não inventa dados que os provedores não retornam: nota, horário de
 * funcionamento e amenidades aparecem no mock do design, mas nenhuma das
 * nossas fontes (Nominatim/Overpass/Mapbox) fornece — então não são exibidos.
 */
export function PoiCard({ poi, onTraceRoute, onSave, onDismiss, isSaved, userPoint }: PoiCardProps) {
  const distanceMeters = userPoint ? haversineDistanceMeters(userPoint, poi.point) : null

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-white/10 bg-surface-card px-gutter pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 shadow-sheet">
      <div className="mx-auto mb-4 h-[5px] w-14 rounded-pill bg-white/20" />

      <div className="flex items-start justify-between gap-3">
        <h2 className="min-w-0 flex-1 text-nav-title text-content-primary">{poi.label}</h2>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Fechar"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-surface-tile text-content-secondary transition-all duration-fast active:scale-[.97] active:opacity-[.88]"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {(poi.secondaryLabel || distanceMeters != null) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
          {poi.secondaryLabel && <Tag tone="neutral">{poi.secondaryLabel}</Tag>}
          {distanceMeters != null && (
            <span className="text-body text-content-secondary">{formatDistance(distanceMeters)} de distância</span>
          )}
        </div>
      )}

      <div className="mt-gutter flex gap-stack">
        <Button
          variant="primary"
          size="lg"
          onClick={onTraceRoute}
          icon={
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.4}>
              <circle cx="6" cy="6" r="2.4" />
              <circle cx="18" cy="18" r="2.4" />
              <path d="M8 7h5a3 3 0 013 3v0a3 3 0 01-3 3H8" strokeLinecap="round" />
            </svg>
          }
        >
          Traçar Rota
        </Button>
        <Button
          variant="secondary"
          size="lg"
          onClick={onSave}
          disabled={isSaved}
          className="max-w-[140px]"
          icon={
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
              <path d="M12 3l2.6 5.8 6.4.6-4.8 4.3 1.4 6.3L12 16.9l-5.6 3.1 1.4-6.3-4.8-4.3 6.4-.6L12 3z" strokeLinejoin="round" />
            </svg>
          }
        >
          {isSaved ? 'Salvo' : 'Salvar'}
        </Button>
      </div>
    </div>
  )
}
