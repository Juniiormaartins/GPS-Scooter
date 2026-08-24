import { VEHICLE_PROFILE } from '@/config/vehicle'
import type { useVehicleBluetooth } from '@/hooks/useVehicleBluetooth'

interface VehicleStatusBarProps {
  bluetooth: ReturnType<typeof useVehicleBluetooth>
}

/**
 * Faixa de status do veículo sobre o mapa (VehicleStatusBar do handoff):
 * ícone verde, modelo em 19px/800, estado da conexão abaixo, e à direita a
 * carga em 22px/800 verde + autonomia restante.
 *
 * Bateria e autonomia SÓ aparecem com conexão Bluetooth real que exponha a
 * leitura (ver services/vehicle/bluetoothConnection.ts) — sem isso, a faixa
 * mostra o veículo configurado e a velocidade de referência, que são dados
 * reais. O mock do design traz "84% · 38 km restáveis"; reproduzir isso sem
 * telemetria seria inventar número na interface.
 */
export function VehicleStatusBar({ bluetooth }: VehicleStatusBarProps) {
  const isConnected = bluetooth.status === 'connected'
  const hasBattery = isConnected && bluetooth.batteryPercent != null
  const remainingRangeKm = hasBattery
    ? Math.round((bluetooth.batteryPercent! / 100) * VEHICLE_PROFILE.estimatedRangeKm)
    : null

  return (
    <div className="pointer-events-auto flex items-center gap-4 rounded-2xl border border-white/10 bg-surface-card/[.86] px-[18px] py-3.5 shadow-float backdrop-blur-xl">
      <svg
        viewBox="0 0 24 24"
        className={`h-[30px] w-[30px] shrink-0 ${isConnected ? 'text-success-500' : 'text-content-tertiary'}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="6" cy="17" r="2.5" />
        <circle cx="17" cy="17" r="2.5" />
        <path d="M6 17h6l3-8h3M9 9h4l2 4" />
      </svg>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[19px] font-extrabold text-content-primary">{VEHICLE_PROFILE.label}</p>
        <p className="mt-0.5 truncate text-body text-content-secondary">
          {isConnected ? 'Conectado via Bluetooth' : `Ref. ${VEHICLE_PROFILE.maxOperationalSpeedKmh} km/h`}
        </p>
      </div>

      {hasBattery && (
        <div className="flex shrink-0 items-baseline gap-2.5 whitespace-nowrap">
          <span className="text-[22px] font-extrabold text-success-500">{bluetooth.batteryPercent}%</span>
          <span className="text-[16px] text-content-secondary">{remainingRangeKm} km restantes</span>
        </div>
      )}
    </div>
  )
}
