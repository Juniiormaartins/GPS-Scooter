import type { GeocodingResult } from '@/services/geocoding'

interface PoiCardProps {
  poi: GeocodingResult
  onTraceRoute: () => void
  onSave: () => void
  onDismiss: () => void
  isSaved: boolean
}

/**
 * Ficha exibida ao selecionar um resultado de busca — nome, categoria/cidade
 * (quando o provedor forneceu) e as duas ações principais do fluxo "encontrei
 * um lugar → quero ir até ele". Não inventa dados que o provedor não deu:
 * `secondaryLabel` já vem formatado por services/geocoding.ts (categoria ·
 * cidade, quando disponível) e simplesmente não aparece quando ausente.
 */
export function PoiCard({ poi, onTraceRoute, onSave, onDismiss, isSaved }: PoiCardProps) {
  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 rounded-t-2xl bg-white p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-floating">
      <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300" />

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold text-navy-900">{poi.label}</p>
          {poi.secondaryLabel && <p className="mt-0.5 truncate text-sm text-slate-500">{poi.secondaryLabel}</p>}
        </div>
        <button type="button" onClick={onDismiss} aria-label="Fechar" className="shrink-0 text-slate-400 active:text-slate-600">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onTraceRoute}
          className="flex-1 rounded-full bg-brand-600 py-3 text-[15px] font-semibold text-white shadow-sm active:scale-[0.99] active:bg-brand-700"
        >
          Traçar rota
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={isSaved}
          className="rounded-full border border-slate-200 px-4 py-3 text-[15px] font-semibold text-navy-900 active:bg-slate-50 disabled:border-success-200 disabled:bg-success-50 disabled:text-success-700"
        >
          {isSaved ? '✓ Salvo' : 'Salvar'}
        </button>
      </div>
    </div>
  )
}
