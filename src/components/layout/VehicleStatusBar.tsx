import { VEHICLE_PROFILE } from '@/config/vehicle'
import type { useVehicleBluetooth } from '@/hooks/useVehicleBluetooth'

interface VehicleStatusBarProps {
  bluetooth: ReturnType<typeof useVehicleBluetooth>
}

/**
 * Card flutuante de status do veículo, na tela inicial — mesma posição e
 * composição do protótipo (ícone de scooter à esquerda, nome + estado de
 * conexão, e à direita o percentual de bateria em destaque).
 *
 * A bateria só aparece quando há conexão Bluetooth REAL com leitura de
 * bateria disponível (ver services/vehicle/bluetoothConnection.ts) — nunca um
 * percentual inventado. Sem conexão, o card mostra o veículo configurado e a
 * velocidade de referência, que são dados reais do perfil.
 */
export function VehicleStatusBar({ bluetooth }: VehicleStatusBarProps) {
  const isConnected = bluetooth.status === 'connected'
  const hasBattery = isConnected && bluetooth.batteryPercent != null
  const remainingRangeKm = hasBattery
    ? Math.round((bluetooth.batteryPercent! / 100) * VEHICLE_PROFILE.estimatedRangeKm)
    : null

  return (
    <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-white/5 bg-surface-card/95 px-4 py-3.5 shadow-floating backdrop-blur">
      <svg
        viewBox="0 0 24 24"
        className={`h-7 w-7 shrink-0 ${isConnected ? 'text-success-400' : 'text-slate-500'}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        <circle cx="6" cy="17" r="2.5" />
        <circle cx="17" cy="17" r="2.5" />
        <path d="M6 17h6l3-8h3M9 9h4l2 4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold text-slate-100">{VEHICLE_PROFILE.label}</p>
        <p className="truncate text-[13px] text-slate-500">
          {isConnected ? 'Conectado via Bluetooth' : `Ref. ${VEHICLE_PROFILE.maxOperationalSpeedKmh} km/h`}
        </p>
      </div>

      {hasBattery && (
        <div className="flex shrink-0 items-baseline gap-1.5">
          <span className="text-lg font-extrabold text-success-400">{bluetooth.batteryPercent}%</span>
          <span className="text-[13px] text-slate-400">{remainingRangeKm} km restantes</span>
        </div>
      )}
    </div>
  )
}
