import { useState } from 'react'
import { Panel } from '@/components/panels/Panel'
import { VEHICLE_PROFILE } from '@/config/vehicle'
import { getUserPreferences, setUserPreferences, type RoutePreference } from '@/config/userPreferences'
import { useVehicleBluetooth } from '@/hooks/useVehicleBluetooth'

interface ProfilePanelProps {
  onClose: () => void
  vehicleBluetooth: ReturnType<typeof useVehicleBluetooth>
}

const ROUTE_PREFERENCE_OPTIONS: { key: RoutePreference; label: string; description: string }[] = [
  { key: 'tranquil', label: 'Mais tranquila', description: 'Prioriza fortemente adequação — só aceita rotas quase perfeitas.' },
  { key: 'balanced', label: 'Equilibrada', description: 'Padrão — bom equilíbrio entre adequação e distância.' },
  { key: 'fast', label: 'Mais rápida', description: 'Aceita mais trechos de atenção em troca de rotas mais rápidas.' },
]

/**
 * Primeira versão funcional do Perfil. A capacidade técnica do veículo é
 * fixa nesta fase (um único perfil, ver config/vehicle.ts) — mas a
 * preferência de estilo de rota já tem efeito real: ajusta a tolerância do
 * ranking de rotas em services/routing/index.ts, não é decorativa.
 */
export function ProfilePanel({ onClose, vehicleBluetooth: bluetooth }: ProfilePanelProps) {
  const [preferences, setPreferences] = useState(getUserPreferences())

  function selectPreference(routePreference: RoutePreference) {
    const next = { ...preferences, routePreference }
    setPreferences(next)
    setUserPreferences(next)
  }

  return (
    <Panel title="Meu veículo" onClose={onClose}>
      <section>
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">Meu veículo</h3>
        <div className="mt-2 rounded-2xl border border-white/5 bg-surface-raised p-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-brand-400">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="6" cy="17" r="2.5" />
                <circle cx="17" cy="17" r="2.5" />
                <path d="M6 17h6l3-8h3M9 9h4l2 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <p className="text-base font-bold text-slate-100">{VEHICLE_PROFILE.label}</p>
          </div>

          <BluetoothStatusRow bluetooth={bluetooth} />

          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-slate-400">Velocidade máxima técnica</dt>
              <dd className="font-semibold text-slate-100">{VEHICLE_PROFILE.technicalTopSpeedKmh} km/h</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-400">Velocidade de referência (ETA)</dt>
              <dd className="font-semibold text-slate-100">{VEHICLE_PROFILE.maxOperationalSpeedKmh} km/h</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-400">Autonomia estimada</dt>
              <dd className="font-semibold text-slate-100">≈{VEHICLE_PROFILE.estimatedRangeKm} km</dd>
            </div>
          </dl>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          A capacidade técnica não autoriza automaticamente vias inadequadas — as regras de circulação continuam
          avaliando cada via independente da velocidade configurada.
        </p>
      </section>

      <section className="mt-6">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">Preferências de rota</h3>
        <div className="mt-2 flex flex-col gap-2">
          {ROUTE_PREFERENCE_OPTIONS.map((option) => {
            const isSelected = preferences.routePreference === option.key
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => selectPreference(option.key)}
                className="flex w-full items-center justify-between rounded-2xl border border-white/5 bg-surface-raised p-3.5 text-left"
              >
                <span>
                  <span className="block text-sm font-bold text-slate-100">{option.label}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{option.description}</span>
                </span>
                <span
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${isSelected ? 'bg-success-500' : 'bg-white/10'}`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      isSelected ? 'translate-x-[22px]' : 'translate-x-0.5'
                    }`}
                  />
                </span>
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Isso influencia qual rota é recomendada entre as elegíveis — nunca libera uma via que a classificação
          considera inadequada.
        </p>
      </section>
    </Panel>
  )
}

/**
 * Estado real de conexão Bluetooth com o veículo — nunca mostra bateria sem
 * uma leitura de verdade (ver services/vehicle/bluetoothConnection.ts).
 * `unsupported` é o caso mais comum na prática hoje: iOS/Safari não tem Web
 * Bluetooth — mostrar isso explicitamente é melhor que esconder a seção.
 */
function BluetoothStatusRow({ bluetooth }: { bluetooth: ReturnType<typeof useVehicleBluetooth> }) {
  if (bluetooth.status === 'unsupported') {
    return (
      <p className="mt-3 rounded-xl bg-white/5 px-3 py-2 text-xs text-slate-500">
        Conexão Bluetooth com o veículo não é suportada neste navegador (comum no Safari/iOS — é uma limitação da
        plataforma, não deste app).
      </p>
    )
  }

  if (bluetooth.status === 'connected') {
    return (
      <div className="mt-3 flex items-center justify-between rounded-xl bg-success-500/10 px-3 py-2">
        <span className="text-xs font-semibold text-success-400">
          Conectado via Bluetooth{bluetooth.deviceName ? ` · ${bluetooth.deviceName}` : ''}
          {bluetooth.batteryPercent != null && ` · ${bluetooth.batteryPercent}% de bateria`}
        </span>
        <button type="button" onClick={bluetooth.disconnect} className="text-xs font-bold text-slate-400 active:text-slate-200">
          Desconectar
        </button>
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={bluetooth.connect}
        disabled={bluetooth.status === 'connecting'}
        className="mt-3 flex w-full items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-left active:bg-white/10 disabled:opacity-60"
      >
        <span className="text-xs font-semibold text-slate-300">
          {bluetooth.status === 'connecting' ? 'Conectando…' : 'Conectar veículo via Bluetooth'}
        </span>
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-brand-400" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M6.5 6.5l11 11L12 22V2l5.5 5.5L6.5 17.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {bluetooth.errorMessage && <p className="mt-1.5 text-xs text-warning-400">{bluetooth.errorMessage}</p>}
    </>
  )
}
