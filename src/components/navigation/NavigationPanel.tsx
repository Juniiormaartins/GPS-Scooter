import { LOW_ACCURACY_THRESHOLD_METERS, type GeolocationSample } from '@/hooks/useGeolocation'
import type { NavigationProgress } from '@/services/navigation/progress'
import { estimateRemainingBatteryPercent } from '@/services/vehicle/batteryEstimate'
import { MOCK_VEHICLE_STATUS } from '@/config/vehicleStatusMock'
import { VEHICLE_PROFILE } from '@/config/vehicle'
import type { ManeuverType, ScoredRoute } from '@/types/routing'
import { formatDistance, formatEta } from '@/utils/geo'

interface NavigationPanelProps {
  scoredRoute: ScoredRoute
  progress: NavigationProgress | null
  gpsSample: GeolocationSample | null
  locationError: string | null
  routeDeviated: boolean
  isRecalculating: boolean
  onStop: () => void
}

/**
 * Estado D — navegação ativa. Toda informação exibida (instrução, distância
 * até a manobra, ETA/distância restantes) vem do progresso real calculado em
 * services/navigation/progress.ts a partir da posição de GPS — nada aqui é
 * mais um valor congelado ou um contador artificial.
 */
export function NavigationPanel({
  scoredRoute,
  progress,
  gpsSample,
  locationError,
  routeDeviated,
  isRecalculating,
  onStop,
}: NavigationPanelProps) {
  const { route, etaMinutes } = scoredRoute

  const remainingDistanceMeters = progress?.remainingDistanceMeters ?? route.totalDistanceMeters
  const remainingDurationMinutes = progress?.remainingDurationMinutes ?? etaMinutes
  const currentSpeedKmh = gpsSample?.speedMps != null ? Math.round(gpsSample.speedMps * 3.6) : null
  const lowAccuracy = gpsSample ? gpsSample.accuracyMeters > LOW_ACCURACY_THRESHOLD_METERS : false
  const batteryEstimate = estimateRemainingBatteryPercent(
    MOCK_VEHICLE_STATUS.batteryPercent,
    progress?.distanceTraveledMeters ?? 0,
  )
  const remainingRangeKm = Math.max(0, Math.round((batteryEstimate.percent / 100) * VEHICLE_PROFILE.estimatedRangeKm))

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        {!progress && !locationError && (
          <div className="pointer-events-auto rounded-2xl bg-navy-900 px-4 py-3 text-sm text-white/80 shadow-floating">
            Obtendo sua localização…
          </div>
        )}

        {locationError && (
          <div className="pointer-events-auto rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 shadow-floating">
            {locationError}
          </div>
        )}

        {routeDeviated && (
          <div className="pointer-events-auto rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white shadow-floating">
            {isRecalculating ? 'Você saiu da rota — recalculando…' : 'Você saiu da rota.'}
          </div>
        )}

        {progress?.nextStep && (
          <div className="pointer-events-auto flex items-center gap-3 rounded-3xl bg-navy-900 p-4 text-white shadow-floating">
            <ManeuverIcon maneuver={progress.nextStep.maneuver} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-bold">{progress.nextStep.instruction}</p>
              <p className="text-sm text-white/60">em {formatDistance(progress.distanceToNextManeuverMeters)}</p>
            </div>
          </div>
        )}

        {progress && lowAccuracy && (
          <div className="pointer-events-auto rounded-2xl bg-white/90 px-4 py-2 text-xs font-medium text-slate-600 shadow-floating">
            Localização com baixa precisão (±{Math.round(gpsSample!.accuracyMeters)} m) — tente uma área aberta.
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0">
        <div className="pointer-events-auto rounded-t-2xl bg-white p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-floating">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-extrabold text-navy-900">{formatEta(remainingDurationMinutes)}</p>
              <p className="text-sm text-slate-500">restantes até o destino</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-extrabold text-navy-900">{formatDistance(remainingDistanceMeters)}</p>
              <p className="text-sm text-slate-500">de distância</p>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {currentSpeedKmh != null ? `${currentSpeedKmh} km/h (GPS)` : 'Velocidade indisponível'}
            </span>
            <span
              className="flex items-center gap-1.5 text-xs font-medium text-slate-500"
              title={`Estimativa: ${MOCK_VEHICLE_STATUS.batteryPercent}% inicial, autonomia de ${VEHICLE_PROFILE.estimatedRangeKm} km — sem integração real de bateria`}
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2}>
                <rect x="2.5" y="7" width="16" height="10" rx="2" />
                <path d="M21 10v4" strokeLinecap="round" />
              </svg>
              ≈{batteryEstimate.percent}% estimado · ≈{remainingRangeKm} km restantes
            </span>
          </div>

          <button
            type="button"
            onClick={onStop}
            className="mt-4 w-full rounded-full bg-red-50 py-3.5 text-[15px] font-semibold text-red-600 active:scale-[0.99] active:bg-red-100"
          >
            Encerrar navegação
          </button>
        </div>
      </div>
    </>
  )
}

function ManeuverIcon({ maneuver }: { maneuver: ManeuverType }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-600">
      {maneuver === 'turn-right' && (
        <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" {...common}>
          <path d="M9 5v6a4 4 0 004 4h6M15 11l4 4-4 4" />
        </svg>
      )}
      {maneuver === 'turn-left' && (
        <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" {...common}>
          <path d="M15 5v6a4 4 0 01-4 4H5M9 11L5 15l4 4" />
        </svg>
      )}
      {(maneuver === 'straight' || maneuver === 'depart' || maneuver === 'other') && (
        <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" {...common}>
          <path d="M12 19V5M6 11l6-6 6 6" />
        </svg>
      )}
      {maneuver === 'roundabout' && (
        <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" {...common}>
          <circle cx="12" cy="12" r="5" />
          <path d="M12 3v4M17 12h4" />
        </svg>
      )}
      {maneuver === 'arrive' && (
        <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" {...common}>
          <path d="M12 2C7.6 2 4 5.6 4 10c0 5.4 7 11.5 7.3 11.8.4.3 1 .3 1.4 0C13 21.5 20 15.4 20 10c0-4.4-3.6-8-8-8zm0 11a3 3 0 110-6 3 3 0 010 6z" />
        </svg>
      )}
    </span>
  )
}
