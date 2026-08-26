import { Button } from '@/components/ui/Button'
import { pinUrl } from '@/components/map/poiLibrary'
import { SuitabilityBar, SuitabilitySummary } from '@/components/route/SuitabilityBar'
import type { LngLat } from '@/config/region'
import type { GeocodingResult } from '@/services/geocoding'
import type { ScoredRoute } from '@/types/routing'
import { formatDistance, formatEta, haversineDistanceMeters } from '@/utils/geo'

interface PoiCardProps {
  poi: GeocodingResult
  onTraceRoute: () => void
  onSave: () => void
  onDismiss: () => void
  isSaved: boolean
  /** Posição atual — usada só para a distância em linha reta enquanto o preview não chega. */
  userPoint?: LngLat | null
  /**
   * Rota de preview já calculada para ESTE destino. É dela que saem os três
   * tiles e a barra de adequação — nada aqui é estimado quando ela existe.
   */
  previewRoute?: ScoredRoute | null
  /** Preview em cálculo — os tiles mostram o estado de espera em vez de número velho. */
  isRouteLoading?: boolean
}

/**
 * Sheet de destino selecionado (handoff tela 03).
 *
 * Estrutura do handoff: handle · nome 22/900 · endereço · botão de fechar ·
 * três tiles (distância, tempo estimado, adequação em fundo verde) ·
 * `SuitabilityBar` + `SuitabilitySummary` · botão `Traçar rota` de 56px.
 *
 * O que NÃO é reproduzido do mock: nota, horário de funcionamento e
 * amenidades. Nenhum dos nossos provedores (Nominatim/Overpass/Mapbox)
 * fornece esses campos — exibi-los seria inventar dado.
 *
 * O tile de ADEQUAÇÃO mostra o `suitabilityScore` real da rota. Ele fica em
 * fundo verde apenas quando a rota é de fato adequada; abaixo disso a cor
 * acompanha a classificação, senão o verde viraria decoração.
 */
export function PoiCard({
  poi,
  onTraceRoute,
  onSave,
  onDismiss,
  isSaved,
  userPoint,
  previewRoute = null,
  isRouteLoading = false,
}: PoiCardProps) {
  const straightLineMeters = userPoint ? haversineDistanceMeters(userPoint, poi.point) : null
  const routeDistanceMeters = previewRoute?.route.totalDistanceMeters ?? null
  const score = previewRoute?.suitabilityScore ?? null
  const hasScore = score != null && previewRoute?.severity.isReliable === true

  return (
    <div className="pointer-events-auto absolute inset-x-3 bottom-0 z-20 rounded-t-2xl bg-surface-card px-card pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[18px] shadow-sheet">
      <div className="mx-auto mb-4 h-[5px] w-11 rounded-pill bg-surface-handle" />

      <div className="flex items-start justify-between gap-3">
        {/*
          O PIN da categoria — a variante que o pacote reserva para "local
          selecionado". Aqui ele cabe (a ficha tem altura), enquanto na LISTA
          de resultados o badge é melhor: pin tem cauda e desalinha linhas de
          altura fixa.

          Só aparece com categoria conhecida; endereço não é ponto de
          interesse, e um pino de categoria ali afirmaria o contrário.
        */}
        {poi.poiCategory && (
          <img
            src={pinUrl(poi.poiCategory)}
            alt=""
            aria-hidden="true"
            className="mt-0.5 h-11 w-[42px] shrink-0 select-none"
          />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sheet-title text-content-primary">{poi.label}</h2>
          {poi.secondaryLabel && (
            <p className="mt-1 truncate text-[13.5px] font-semibold text-content-secondary">{poi.secondaryLabel}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Fechar"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-surface-tile text-content-secondary transition-all duration-fast active:scale-[.97] active:opacity-[.88]"
        >
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <StatTile
          value={
            routeDistanceMeters != null
              ? formatDistance(routeDistanceMeters)
              : straightLineMeters != null
                ? `≈${formatDistance(straightLineMeters)}`
                : '—'
          }
          label={routeDistanceMeters != null ? 'DISTÂNCIA' : 'LINHA RETA'}
          loading={isRouteLoading && routeDistanceMeters == null}
        />
        <StatTile
          value={previewRoute ? formatEta(previewRoute.etaMinutes) : '—'}
          label="ESTIMADO"
          loading={isRouteLoading && !previewRoute}
        />
        <StatTile
          value={hasScore ? `${score}%` : '—'}
          label="ADEQUAÇÃO"
          loading={isRouteLoading && !previewRoute}
          tone={hasScore ? (score >= 80 ? 'go' : score >= 60 ? 'warn' : 'danger') : 'neutral'}
        />
      </div>

      {previewRoute && (
        <div className="mt-3.5 flex flex-col gap-2">
          <SuitabilityBar severity={previewRoute.severity} />
          <SuitabilitySummary severity={previewRoute.severity} />
        </div>
      )}

      <div className="mt-4 flex gap-2.5">
        <Button variant="primary" size="lg" onClick={onTraceRoute}>
          Traçar rota
        </Button>
        <Button
          variant="secondary"
          size="lg"
          onClick={onSave}
          disabled={isSaved}
          className="max-w-[132px]"
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

/** Tile de métrica do handoff: raio 16px, número 19/900 + rótulo 11.5/700. */
function StatTile({
  value,
  label,
  loading = false,
  tone = 'neutral',
}: {
  value: string
  label: string
  loading?: boolean
  tone?: 'neutral' | 'go' | 'warn' | 'danger'
}) {
  const surface = {
    neutral: 'bg-surface-sunken',
    go: 'bg-state-go',
    warn: 'bg-state-warn',
    danger: 'bg-state-danger',
  }[tone]
  const valueColor = {
    neutral: 'text-content-primary',
    go: 'text-success-600',
    warn: 'text-warning-text',
    danger: 'text-danger-text',
  }[tone]

  return (
    <div className={`rounded-tile px-3 py-2.5 text-center ${surface}`}>
      {loading ? (
        <span className="mx-auto block h-[19px] w-12 animate-pulse rounded-sm bg-surface-tile" />
      ) : (
        <span className={`block text-metric-tile ${valueColor}`}>{value}</span>
      )}
      <span className="mt-1 block text-[10.5px] font-extrabold tracking-[0.6px] text-content-quaternary">{label}</span>
    </div>
  )
}
