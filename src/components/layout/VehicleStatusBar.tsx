import { resolveVehicleLabel, type UserPreferences } from '@/config/userPreferences'
import type { useVehicleBluetooth } from '@/hooks/useVehicleBluetooth'

interface VehicleStatusBarProps {
  bluetooth: ReturnType<typeof useVehicleBluetooth>
  /** Preferências do usuário — fonte de verdade do veículo ativo, não a constante fixa. */
  preferences: UserPreferences
  /** Abre o seletor de veículo. Ausente = a barra é só informativa. */
  onOpen?: () => void
  /** Variante compacta (raio 22px), usada abaixo da sheet de destino — handoff tela 03. */
  compact?: boolean
}

/**
 * Barra de status do veículo (handoff §5.1): tile de ícone 44px, nome +
 * subtítulo, autonomia à direita em verde 17/900 com rótulo `AUTONOMIA`, e
 * chevron indicando que a barra abre o seletor.
 *
 * SOBRE A AUTONOMIA — a diferença que importa:
 *
 * - Com Bluetooth conectado e telemetria de bateria, mostramos a autonomia
 *   RESTANTE (bateria × alcance do veículo). É leitura real.
 * - Sem telemetria, mostramos o alcance CONFIGURADO no perfil, rotulado como
 *   estimativa. Também é dado real — o usuário escolheu esse número —, só não
 *   é medição.
 *
 * O mock do handoff traz `38 km AUTONOMIA` com o subtítulo `Autopropelido ·
 * pareada`. "Pareada" só aparece quando há pareamento de verdade: escrever
 * isso com o Bluetooth desconectado seria afirmar um estado inexistente.
 */
export function VehicleStatusBar({ bluetooth, preferences, onOpen, compact = false }: VehicleStatusBarProps) {
  const isConnected = bluetooth.status === 'connected'
  const hasBattery = isConnected && bluetooth.batteryPercent != null
  const rangeKm = hasBattery ? Math.round((bluetooth.batteryPercent! / 100) * preferences.rangeKm) : preferences.rangeKm

  const subtitle = isConnected
    ? hasBattery
      ? `Autopropelido · pareada · ${bluetooth.batteryPercent}%`
      : 'Autopropelido · pareada'
    : `Autopropelido · ref. ${preferences.referenceSpeedKmh} km/h`

  const Element = onOpen ? 'button' : 'div'

  return (
    <Element
      {...(onOpen ? { type: 'button' as const, onClick: onOpen } : {})}
      className={`pointer-events-auto flex w-full items-center gap-3 border border-hairline/[.06] bg-surface-overlay px-4 py-3 text-left shadow-field backdrop-blur-xl transition-all duration-fast ease-standard ${
        compact ? 'rounded-bar' : 'rounded-2xl'
      } ${onOpen ? 'active:scale-[.97] active:opacity-[.88]' : ''}`}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-surface-tile-accent text-brand-500">
        <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="6" cy="17" r="2.5" />
          <circle cx="17" cy="17" r="2.5" />
          <path d="M6 17h6l3-8h3M9 9h4l2 4" />
        </svg>
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-row-name text-content-primary">{resolveVehicleLabel(preferences)}</span>
        <span className="mt-0.5 block truncate text-[13px] font-semibold text-content-secondary">{subtitle}</span>
      </span>

      <span className="shrink-0 text-right">
        <span className="block whitespace-nowrap text-[17px] font-black leading-tight text-success-500">
          {rangeKm} km
        </span>
        <span className="mt-0.5 block text-[10.5px] font-extrabold tracking-[0.6px] text-content-quaternary">
          {hasBattery ? 'AUTONOMIA' : 'ALCANCE EST.'}
        </span>
      </span>

      {onOpen && (
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-content-tertiary" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 15l-6-6-6 6" />
        </svg>
      )}
    </Element>
  )
}
