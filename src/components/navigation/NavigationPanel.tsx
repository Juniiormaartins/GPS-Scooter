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
  /** Percentual REAL lido via Bluetooth do veículo, quando conectado e o dispositivo expõe essa telemetria — null caso contrário (nunca um valor fabricado). */
  vehicleBattery: number | null
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
  vehicleBattery,
  onStop,
}: NavigationPanelProps) {
  const { route, etaMinutes } = scoredRoute

  const remainingDistanceMeters = progress?.remainingDistanceMeters ?? route.totalDistanceMeters
  const remainingDurationMinutes = progress?.remainingDurationMinutes ?? etaMinutes
  const currentSpeedKmh = gpsSample?.speedMps != null ? Math.round(gpsSample.speedMps * 3.6) : null
  const lowAccuracy = gpsSample ? gpsSample.accuracyMeters > LOW_ACCURACY_THRESHOLD_METERS : false
  // Bateria REAL (Bluetooth conectado e dispositivo expõe a leitura) tem prioridade sobre a estimativa por
  // fórmula — a estimativa (services/vehicle/batteryEstimate.ts) só existe como aproximação honesta quando
  // não há telemetria real disponível, nunca finge ser uma leitura de hardware.
  const batteryEstimate = estimateRemainingBatteryPercent(
    MOCK_VEHICLE_STATUS.batteryPercent,
    progress?.distanceTraveledMeters ?? 0,
  )
  const batteryPercent = vehicleBattery ?? batteryEstimate.percent
  const remainingRangeKm = Math.max(0, Math.round((batteryPercent / 100) * VEHICLE_PROFILE.estimatedRangeKm))

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        {!progress && !locationError && (
          <div className="pointer-events-auto rounded-2xl border border-white/5 bg-surface-card px-4 py-3 text-sm text-slate-300 shadow-floating">
            Obtendo sua localização…
          </div>
        )}

        {locationError && (
          <div className="pointer-events-auto rounded-2xl bg-warning-500/15 px-4 py-3 text-sm font-medium text-warning-300 shadow-floating">
            {locationError}
          </div>
        )}

        {routeDeviated && (
          <div className="pointer-events-auto rounded-2xl bg-warning-500 px-4 py-3 text-sm font-semibold text-surface shadow-floating">
            {isRecalculating ? 'Você saiu da rota — recalculando…' : 'Você saiu da rota.'}
          </div>
        )}

        {progress?.nextStep && (
          <div className="pointer-events-auto flex items-center gap-3 rounded-3xl border border-white/5 bg-surface-card p-4 text-slate-100 shadow-floating">
            <ManeuverIcon maneuver={progress.nextStep.maneuver} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-bold">{progress.nextStep.instruction}</p>
              <p className="text-sm text-slate-400">em {formatDistance(progress.distanceToNextManeuverMeters)}</p>
            </div>
          </div>
        )}

        {progress && lowAccuracy && (
          <div className="pointer-events-auto rounded-2xl border border-white/5 bg-surface-card/90 px-4 py-2 text-xs font-medium text-slate-400 shadow-floating">
            Localização com baixa precisão (±{Math.round(gpsSample!.accuracyMeters)} m) — tente uma área aberta.
          </div>
        )}
      </div>

      {/* Pílulas flutuantes de velocidade/bateria — separadas do bottom sheet, lado a lado, acima dele. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[calc(9.5rem+env(safe-area-inset-bottom))] flex justify-between px-3">
        <span className="pointer-events-auto rounded-2xl border border-white/5 bg-surface-card/95 px-4 py-2.5 text-center shadow-floating backdrop-blur">
          <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Velocidade</span>
          <span className="block text-lg font-extrabold text-slate-100">
            {currentSpeedKmh != null ? currentSpeedKmh : '—'}
            <span className="ml-0.5 text-xs font-semibold text-slate-500">km/h</span>
          </span>
        </span>
        <span
          className="pointer-events-auto rounded-2xl border border-white/5 bg-surface-card/95 px-4 py-2.5 text-center shadow-floating backdrop-blur"
          title={
            vehicleBattery != null
              ? 'Leitura real do veículo conectado via Bluetooth'
              : `Estimativa: ${MOCK_VEHICLE_STATUS.batteryPercent}% inicial, autonomia de ${VEHICLE_PROFILE.estimatedRangeKm} km — sem integração real de bateria`
          }
        >
          <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Bateria</span>
          <span className={`block text-lg font-extrabold ${vehicleBattery != null ? 'text-success-400' : 'text-slate-100'}`}>
            {vehicleBattery != null ? vehicleBattery : `≈${batteryPercent}`}
            <span className="ml-0.5 text-xs font-semibold text-slate-500">%</span>
          </span>
        </span>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0">
        <div className="pointer-events-auto rounded-t-2xl border-t border-white/5 bg-surface-card p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-floating">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15" />
          <div className="flex items-center justify-between text-center">
            <div className="flex-1">
              <p className="text-xl font-extrabold text-slate-100">{formatEta(remainingDurationMinutes)}</p>
              <p className="text-xs text-slate-400">tempo restante</p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="flex-1">
              <p className="text-xl font-extrabold text-slate-100">{formatDistance(remainingDistanceMeters)}</p>
              <p className="text-xs text-slate-400">distância restante</p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="flex-1">
              <p className="text-xl font-extrabold text-slate-100">{estimatedArrivalTime(remainingDurationMinutes)}</p>
              <p className="text-xs text-slate-400">chegada</p>
            </div>
          </div>
          {vehicleBattery == null && (
            <p className="mt-2 text-center text-[11px] text-slate-500">
              ≈{remainingRangeKm} km de autonomia restante estimada
            </p>
          )}

          <button
            type="button"
            onClick={onStop}
            className="mt-4 w-full rounded-full bg-danger-500/15 py-3.5 text-[15px] font-semibold text-danger-400 active:scale-[0.99] active:bg-danger-500/25"
          >
            Encerrar navegação
          </button>
        </div>
      </div>
    </>
  )
}

/** Hora prevista de chegada — calculada a partir do tempo restante real (progress), nunca fixa. */
function estimatedArrivalTime(remainingMinutes: number): string {
  const arrival = new Date(Date.now() + remainingMinutes * 60_000)
  return arrival.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function ManeuverIcon({ maneuver }: { maneuver: ManeuverType }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-500">
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
