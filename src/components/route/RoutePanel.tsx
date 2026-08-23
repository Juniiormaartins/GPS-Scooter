import { VEHICLE_PROFILE } from '@/config/vehicle'
import { TIER_LABEL } from '@/services/routing/roadClassification'
import type { Eligibility, ScoredRoute } from '@/types/routing'
import { formatDistance, formatEta } from '@/utils/geo'

const LABEL_TEXT: Record<NonNullable<ScoredRoute['label']>, string> = {
  recommended: 'Recomendada',
  fastest: 'Mais rápida',
  safest: 'Mais tranquila',
}

const ELIGIBILITY_TONE: Record<Eligibility, { bg: string; text: string; emoji: string; label: string }> = {
  allowed: { bg: 'bg-success-50', text: 'text-success-700', emoji: '🟢', label: 'Rota adequada' },
  discouraged: { bg: 'bg-amber-50', text: 'text-amber-700', emoji: '🟡', label: 'Rota com ressalvas' },
  'not-allowed': { bg: 'bg-red-50', text: 'text-red-700', emoji: '🔴', label: 'Rota não recomendada' },
}

/** Resumo mínimo mostrado com o Bottom Sheet recolhido — só a rota ativa, sem lista. */
export function RouteSummary({ scoredRoute }: { scoredRoute: ScoredRoute }) {
  const tone = ELIGIBILITY_TONE[scoredRoute.eligibility]
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xl font-extrabold text-navy-900">
          {tone.emoji} {formatEta(scoredRoute.etaMinutes)} · {formatDistance(scoredRoute.route.totalDistanceMeters)}
        </p>
        <p className="text-xs text-slate-500">↑ arraste para ver opções</p>
      </div>
    </div>
  )
}

interface RoutePanelProps {
  /** Todas as rotas em ORDEM ESTÁVEL (não reordena ao selecionar — só `activeRouteId` muda). */
  routes: ScoredRoute[]
  activeRouteId: string
  onSelectRoute: (routeId: string) => void
  onStartNavigation: () => void
  onDismiss: () => void
}

export function RoutePanel({ routes, activeRouteId, onSelectRoute, onStartNavigation, onDismiss }: RoutePanelProps) {
  const activeRoute = routes.find((entry) => entry.route.id === activeRouteId) ?? routes[0]
  if (!activeRoute) return null

  const { route, breakdown, highlights } = activeRoute

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-500">{routes.length > 1 ? 'Opções de rota' : 'Rota'}</p>
        <button type="button" onClick={onDismiss} className="text-sm font-medium text-slate-400 active:text-slate-600">
          Fechar
        </button>
      </div>

      {routes.length > 1 && (
        <div className="flex flex-col gap-2">
          {routes.map((entry) => (
            <RouteOptionCard
              key={entry.route.id}
              scoredRoute={entry}
              isSelected={entry.route.id === activeRouteId}
              onSelect={() => onSelectRoute(entry.route.id)}
            />
          ))}
        </div>
      )}

      <div className="rounded-2xl bg-slate-50 p-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-2xl font-extrabold text-navy-900">{formatEta(activeRoute.etaMinutes)}</p>
            <p className="mt-0.5 text-sm text-slate-500">
              {formatDistance(route.totalDistanceMeters)} · {VEHICLE_PROFILE.label}
            </p>
          </div>
          <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600">
            Ref. {VEHICLE_PROFILE.maxOperationalSpeedKmh} km/h
          </span>
        </div>

        {highlights.length > 0 && (
          <ul className="mt-2 space-y-1">
            {highlights.map((text) => (
              <li key={text} className="text-sm text-slate-600">
                {text}
              </li>
            ))}
          </ul>
        )}

        {breakdown.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {breakdown.map((entry) => (
              <span key={entry.tier} className={`rounded-full px-2.5 py-1 text-xs font-medium ${tierChipClass(entry.tier)}`}>
                {formatDistance(entry.distanceMeters)} · {TIER_LABEL[entry.tier]}
              </span>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onStartNavigation}
        className="w-full shrink-0 rounded-full bg-brand-600 py-3.5 text-[15px] font-semibold text-white shadow-sm active:scale-[0.99] active:bg-brand-700"
      >
        Iniciar navegação
      </button>
    </div>
  )
}

function RouteOptionCard({ scoredRoute, isSelected, onSelect }: { scoredRoute: ScoredRoute; isSelected: boolean; onSelect: () => void }) {
  const tone = ELIGIBILITY_TONE[scoredRoute.eligibility]

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-2xl border p-3 text-left transition-colors ${
        isSelected ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white active:bg-slate-50'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-navy-900">
          {tone.emoji} {scoredRoute.label ? LABEL_TEXT[scoredRoute.label] : 'Alternativa'}
        </span>
        {isSelected && <span className="shrink-0 text-xs font-bold text-brand-700">✓ Selecionada</span>}
      </div>
      <p className="mt-0.5 text-sm text-slate-600">
        {formatDistance(scoredRoute.route.totalDistanceMeters)} · {formatEta(scoredRoute.etaMinutes)} · {scoredRoute.suitabilityScore}/100
      </p>
      {scoredRoute.highlights[0] && <p className="mt-0.5 truncate text-xs text-slate-500">{scoredRoute.highlights[0]}</p>}
    </button>
  )
}

function tierChipClass(tier: string): string {
  if (tier === 'very-good' || tier === 'good') return 'bg-success-50 text-success-700'
  if (tier === 'caution') return 'bg-amber-50 text-amber-700'
  return 'bg-red-50 text-red-700'
}
