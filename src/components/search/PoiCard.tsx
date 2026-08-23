import type { LngLat } from '@/config/region'
import type { GeocodingResult } from '@/services/geocoding'
import { formatDistance, haversineDistanceMeters } from '@/utils/geo'

interface PoiCardProps {
  poi: GeocodingResult
  onTraceRoute: () => void
  onSave: () => void
  onDismiss: () => void
  isSaved: boolean
  /** Posição atual do usuário, quando conhecida — usada só para o chip de distância (dado real; sem ela, o chip simplesmente não aparece). */
  userPoint?: LngLat | null
}

/**
 * Ficha exibida ao selecionar um resultado de busca — nome, categoria/cidade
 * (quando o provedor forneceu) e as duas ações principais do fluxo "encontrei
 * um lugar → quero ir até ele". Não inventa dados que o provedor não deu:
 * `secondaryLabel` já vem formatado por services/geocoding.ts (categoria ·
 * cidade, quando disponível) e simplesmente não aparece quando ausente — o
 * mesmo vale para nota/horário de funcionamento, que nenhuma das nossas
 * fontes (Nominatim/Overpass/Mapbox) retorna: não aparecem aqui.
 */
export function PoiCard({ poi, onTraceRoute, onSave, onDismiss, isSaved, userPoint }: PoiCardProps) {
  const distanceMeters = userPoint ? haversineDistanceMeters(userPoint, poi.point) : null

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-white/5 bg-surface-card p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-floating">
      <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15" />

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold text-slate-100">{poi.label}</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-400">
            {poi.secondaryLabel && <span className="truncate">{poi.secondaryLabel}</span>}
            {poi.secondaryLabel && distanceMeters != null && <span>·</span>}
            {distanceMeters != null && <span className="shrink-0">{formatDistance(distanceMeters)}</span>}
          </p>
        </div>
        <button type="button" onClick={onDismiss} aria-label="Fechar" className="shrink-0 text-slate-500 active:text-slate-300">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onTraceRoute}
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-brand-500 py-3 text-[15px] font-bold text-surface shadow-sm active:scale-[0.99] active:bg-brand-400"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4}>
            <circle cx="6" cy="6" r="2.4" />
            <circle cx="18" cy="18" r="2.4" />
            <path d="M8 7h5a3 3 0 013 3v0a3 3 0 01-3 3H8" strokeLinecap="round" />
          </svg>
          Traçar rota
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={isSaved}
          className="flex items-center gap-1.5 rounded-full border border-white/10 px-4 py-3 text-[15px] font-semibold text-slate-100 active:bg-white/5 disabled:border-transparent disabled:bg-success-500/15 disabled:text-success-400"
        >
          {isSaved ? (
            <>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M5 12l4 4 10-10" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Salvo
            </>
          ) : (
            'Salvar'
          )}
        </button>
      </div>
    </div>
  )
}
