import { VEHICLE_PROFILE } from '@/config/vehicle'
import { TIER_LABEL } from '@/services/routing/roadClassification'
import type { Eligibility, ScoredRoute } from '@/types/routing'
import { formatDistance, formatEta } from '@/utils/geo'

const LABEL_TEXT: Record<NonNullable<ScoredRoute['label']>, string> = {
  recommended: 'Recomendada',
  fastest: 'Mais rápida',
  safest: 'Mais tranquila',
}

/** Selo colorido por elegibilidade — substitui os emojis 🟢🟡🔴 usados antes por um badge de texto, igual ao protótipo. */
const ELIGIBILITY_TONE: Record<Eligibility, { badge: string; dot: string; border: string; text: string; label: string }> = {
  allowed: { badge: 'bg-success-500 text-surface', dot: 'bg-success-400', border: 'border-success-500', text: 'text-success-400', label: 'Rota adequada' },
  discouraged: { badge: 'bg-warning-500 text-surface', dot: 'bg-warning-400', border: 'border-warning-500', text: 'text-warning-400', label: 'Rota com ressalvas' },
  'not-allowed': { badge: 'bg-danger-500 text-surface', dot: 'bg-danger-400', border: 'border-danger-500', text: 'text-danger-400', label: 'Rota não recomendada' },
}

/** Resumo mínimo mostrado com o Bottom Sheet recolhido — só a rota ativa, sem lista. */
export function RouteSummary({ scoredRoute }: { scoredRoute: ScoredRoute }) {
  const tone = ELIGIBILITY_TONE[scoredRoute.eligibility]
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot}`} />
        <p className="text-xl font-extrabold text-slate-100">
          {formatEta(scoredRoute.etaMinutes)} · {formatDistance(scoredRoute.route.totalDistanceMeters)}
        </p>
      </div>
      <p className="text-xs text-slate-500">↑ arraste para ver opções</p>
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
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{routes.length > 1 ? 'Opções de rota' : 'Rota'}</p>
        <button type="button" onClick={onDismiss} className="text-sm font-medium text-slate-500 active:text-slate-300">
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

      <div className="rounded-2xl border border-white/5 bg-surface-raised p-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-2xl font-extrabold text-slate-100">{formatEta(activeRoute.etaMinutes)}</p>
            <p className="mt-0.5 text-sm text-slate-400">
              {formatDistance(route.totalDistanceMeters)} · {VEHICLE_PROFILE.label}
            </p>
          </div>
          <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-300">
            Ref. {VEHICLE_PROFILE.maxOperationalSpeedKmh} km/h
          </span>
        </div>

        {highlights.length > 0 && (
          <ul className="mt-2 space-y-1">
            {highlights.map((text) => (
              <li key={text} className="text-sm text-slate-400">
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
        className="flex w-full shrink-0 items-center justify-center gap-2 rounded-full bg-success-500 py-3.5 text-[15px] font-bold text-surface shadow-sm active:scale-[0.99] active:bg-success-400"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
          <path d="M3 11l18-8-8 18-2-8-8-2z" />
        </svg>
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
      className={`w-full rounded-2xl border-2 border-l-[6px] p-3.5 text-left transition-all ${
        isSelected
          ? `${tone.border} bg-surface-raised shadow-floating`
          : 'border-white/5 border-l-white/10 bg-surface-raised/40 active:bg-surface-raised/70'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${tone.badge}`}>
          {scoredRoute.label ? LABEL_TEXT[scoredRoute.label] : 'Alternativa'}
        </span>
        <div className="shrink-0 text-right">
          <span className={`block font-extrabold leading-none text-slate-100 ${isSelected ? 'text-2xl' : 'text-lg'}`}>
            {formatEta(scoredRoute.etaMinutes)}
          </span>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 text-sm text-slate-300">
        <span className="font-semibold">{formatDistance(scoredRoute.route.totalDistanceMeters)}</span>
        <span className="text-slate-600">·</span>
        <span className={`font-semibold ${tone.text}`}>{scoredRoute.suitabilityScore}/100 adequação</span>
      </div>
      {scoredRoute.highlights[0] && <p className="mt-1 text-xs text-slate-500">{scoredRoute.highlights[0]}</p>}
    </button>
  )
}

function tierChipClass(tier: string): string {
  if (tier === 'very-good' || tier === 'good') return 'bg-success-500/15 text-success-400'
  if (tier === 'caution') return 'bg-warning-500/15 text-warning-400'
  return 'bg-danger-500/15 text-danger-400'
}
