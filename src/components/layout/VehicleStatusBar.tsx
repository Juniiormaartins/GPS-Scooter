import { VEHICLE_PROFILE } from '@/config/vehicle'
import type { useVehicleBluetooth } from '@/hooks/useVehicleBluetooth'

interface VehicleStatusBarProps {
  bluetooth: ReturnType<typeof useVehicleBluetooth>
}

/**
 * Card flutuante de status do veículo, na tela inicial — mesma posição do
 * protótipo (acima da navegação inferior). Mostra o perfil real do veículo
 * sempre; a bateria só aparece quando há uma conexão Bluetooth real com
 * leitura de bateria (ver services/vehicle/bluetoothConnection.ts) — nunca
 * um percentual inventado.
 */
export function VehicleStatusBar({ bluetooth }: VehicleStatusBarProps) {
  return (
    <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-white/5 bg-surface-card/95 px-4 py-3 shadow-floating backdrop-blur">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-brand-400">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="6" cy="17" r="2.5" />
          <circle cx="17" cy="17" r="2.5" />
          <path d="M6 17h6l3-8h3M9 9h4l2 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-slate-100">{VEHICLE_PROFILE.label}</p>
        <p className="truncate text-xs text-slate-400">
          {bluetooth.status === 'connected'
            ? `Conectado via Bluetooth${bluetooth.batteryPercent != null ? ` · ${bluetooth.batteryPercent}% de bateria` : ''}`
            : `Ref. ${VEHICLE_PROFILE.maxOperationalSpeedKmh} km/h`}
        </p>
      </div>
      {bluetooth.status === 'connected' && bluetooth.batteryPercent != null && (
        <span className="shrink-0 text-sm font-extrabold text-success-400">{bluetooth.batteryPercent}%</span>
      )}
    </div>
  )
}
