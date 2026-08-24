import type { ReactNode } from 'react'
import { LOW_ACCURACY_THRESHOLD_METERS, type GeolocationSample } from '@/hooks/useGeolocation'
import type { NavigationProgress } from '@/services/navigation/progress'
import type { ManeuverType, ScoredRoute } from '@/types/routing'
import { formatDistance, formatEta } from '@/utils/geo'

interface NavigationPanelProps {
  scoredRoute: ScoredRoute
  progress: NavigationProgress | null
  gpsSample: GeolocationSample | null
  locationError: string | null
  routeDeviated: boolean
  isRecalculating: boolean
  /**
   * Percentual REAL lido via Bluetooth, quando conectado e o dispositivo expõe
   * a telemetria — null caso contrário. Hoje nada é exibido a partir disso: a
   * pílula de bateria saiu da tela por não ter leitura real na maioria dos
   * casos. A prop permanece para quando a integração com o veículo existir.
   */
  vehicleBattery: number | null
  /** Botão de recentralizar, injetado por App.tsx para ficar na faixa inferior sem sobrepor os painéis. */
  recenterControl?: ReactNode
  onStop: () => void
}

/**
 * Tela de navegação ativa (tela 4 do handoff): `GuidanceBanner` no topo,
 * `StatPill` de velocidade e bateria nos cantos inferiores, e `NavStatsBar`
 * de três colunas ancorada acima do home indicator.
 *
 * Todos os valores vêm do progresso real calculado a partir do GPS
 * (services/navigation/progress.ts) — nada aqui é contador artificial.
 */
export function NavigationPanel({
  scoredRoute,
  progress,
  gpsSample,
  locationError,
  routeDeviated,
  isRecalculating,
  vehicleBattery,
  recenterControl,
  onStop,
}: NavigationPanelProps) {
  const { route, etaMinutes } = scoredRoute

  const remainingDistanceMeters = progress?.remainingDistanceMeters ?? route.totalDistanceMeters
  const remainingDurationMinutes = progress?.remainingDurationMinutes ?? etaMinutes
  const currentSpeedKmh = gpsSample?.speedMps != null ? Math.round(gpsSample.speedMps * 3.6) : null
  const lowAccuracy = gpsSample ? gpsSample.accuracyMeters > LOW_ACCURACY_THRESHOLD_METERS : false

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-2.5 px-gutter pt-[max(1rem,env(safe-area-inset-top))]">
        {progress?.nextStep ? (
          <div className="pointer-events-auto flex items-center gap-4 rounded-2xl border border-white/10 bg-surface-card/[.86] px-3.5 py-3 shadow-float backdrop-blur-xl">
            <ManeuverIcon maneuver={progress.nextStep.maneuver} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[21px] font-extrabold leading-tight text-content-primary">
                {progress.nextStep.instruction}
              </p>
              <p className="mt-0.5 truncate text-[16px] text-content-secondary">
                {progress.nextStep.roadName && `${progress.nextStep.roadName} `}
                <span className="font-bold text-brand-500">
                  {formatDistance(progress.distanceToNextManeuverMeters)}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={onStop}
              aria-label="Encerrar navegação"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-surface-tile text-content-secondary transition-all duration-fast active:scale-[.97] active:opacity-[.88]"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="pointer-events-auto rounded-2xl border border-white/10 bg-surface-card/[.86] px-card py-3.5 text-body text-content-secondary shadow-float backdrop-blur-xl">
            {locationError ?? 'Obtendo sua localização…'}
          </div>
        )}

        {routeDeviated && (
          <div className="pointer-events-auto rounded-lg bg-warning-500 px-card py-2.5 text-body font-bold text-content-on-accent shadow-float">
            {isRecalculating ? 'Você saiu da rota — recalculando…' : 'Você saiu da rota.'}
          </div>
        )}

        {progress && lowAccuracy && (
          <div className="pointer-events-auto rounded-lg border border-white/10 bg-surface-card/[.86] px-card py-2 text-caption text-content-secondary shadow-float backdrop-blur-xl">
            Localização com baixa precisão (±{Math.round(gpsSample!.accuracyMeters)} m) — tente uma área aberta.
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-stack px-gutter pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {/*
          Faixa inferior: velocidade real do GPS à esquerda e o botão de
          recentralizar à direita — este é o único lugar da navegação onde ele
          aparece, alinhado à mesma linha de base, sem sobrepor nada.

          A pílula de BATERIA foi removida: sem veículo conectado por Bluetooth,
          o valor vinha de uma estimativa sobre um percentual inicial fixo
          (config/vehicleStatusMock.ts) — ou seja, um número sem leitura real
          por trás. Quando houver telemetria de verdade, ela volta como
          `vehicleBattery` (a prop e o encanamento continuam existindo).
        */}
        <div className="flex items-end justify-between">
          <StatPill label="Velocidade" value={currentSpeedKmh != null ? `${currentSpeedKmh} km/h` : '—'} />
          {recenterControl}
        </div>

        <div className="pointer-events-auto grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-surface-card/[.86] px-3 py-card shadow-float backdrop-blur-xl">
          <NavStat value={arrivalTime(remainingDurationMinutes)} label="Hora de chegada" tone="accent" />
          <NavStat value={formatEta(remainingDurationMinutes)} label="Tempo restante" />
          <NavStat value={formatDistance(remainingDistanceMeters)} label="Distância restante" />
        </div>
      </div>
    </>
  )
}

/** Leitura flutuante pequena sobre o mapa (hoje só a velocidade real do GPS). */
function StatPill({
  label,
  value,
  tone = 'default',
  title,
}: {
  label: string
  value: string
  tone?: 'default' | 'go'
  title?: string
}) {
  return (
    <div
      title={title}
      className="pointer-events-auto inline-flex flex-col gap-1 rounded-lg border border-white/10 bg-surface-card/[.86] px-card py-2.5 shadow-float backdrop-blur-xl"
    >
      <span className="text-eyebrow uppercase text-content-tertiary">{label}</span>
      <span className={`text-[24px] font-extrabold ${tone === 'go' ? 'text-success-500' : 'text-content-primary'}`}>
        {value}
      </span>
    </div>
  )
}

function NavStat({ value, label, tone = 'default' }: { value: string; label: string; tone?: 'default' | 'accent' }) {
  return (
    <div className="text-center">
      <p className={`text-[27px] font-extrabold leading-tight ${tone === 'accent' ? 'text-brand-500' : 'text-content-primary'}`}>
        {value}
      </p>
      <p className="mt-1 text-[14px] text-content-secondary">{label}</p>
    </div>
  )
}

/** Hora prevista de chegada, derivada do tempo restante real — 24h, como manda o handoff. */
function arrivalTime(remainingMinutes: number): string {
  return new Date(Date.now() + remainingMinutes * 60_000).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ManeuverIcon({ maneuver }: { maneuver: ManeuverType }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  return (
    <span className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-lg bg-brand-500 text-content-on-accent">
      {maneuver === 'turn-right' && (
        <svg viewBox="0 0 24 24" className="h-[30px] w-[30px]" {...common}>
          <path d="M9 5v6a4 4 0 004 4h6M15 11l4 4-4 4" />
        </svg>
      )}
      {maneuver === 'turn-left' && (
        <svg viewBox="0 0 24 24" className="h-[30px] w-[30px]" {...common}>
          <path d="M15 5v6a4 4 0 01-4 4H5M9 11L5 15l4 4" />
        </svg>
      )}
      {(maneuver === 'straight' || maneuver === 'depart' || maneuver === 'other') && (
        <svg viewBox="0 0 24 24" className="h-[30px] w-[30px]" {...common}>
          <path d="M12 19V5M6 11l6-6 6 6" />
        </svg>
      )}
      {maneuver === 'roundabout' && (
        <svg viewBox="0 0 24 24" className="h-[30px] w-[30px]" {...common}>
          <circle cx="12" cy="12" r="5" />
          <path d="M12 3v4M17 12h4" />
        </svg>
      )}
      {maneuver === 'arrive' && (
        <svg viewBox="0 0 24 24" className="h-[30px] w-[30px]" {...common}>
          <path d="M12 2C7.6 2 4 5.6 4 10c0 5.4 7 11.5 7.3 11.8.4.3 1 .3 1.4 0C13 21.5 20 15.4 20 10c0-4.4-3.6-8-8-8zm0 11a3 3 0 110-6 3 3 0 010 6z" />
        </svg>
      )}
    </span>
  )
}
