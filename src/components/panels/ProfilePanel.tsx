import { useState } from 'react'
import { Panel } from '@/components/panels/Panel'
import { VEHICLE_PROFILE } from '@/config/vehicle'
import { getUserPreferences, setUserPreferences, type RoutePreference } from '@/config/userPreferences'

interface ProfilePanelProps {
  onClose: () => void
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
export function ProfilePanel({ onClose }: ProfilePanelProps) {
  const [preferences, setPreferences] = useState(getUserPreferences())

  function selectPreference(routePreference: RoutePreference) {
    const next = { ...preferences, routePreference }
    setPreferences(next)
    setUserPreferences(next)
  }

  return (
    <Panel title="Meu veículo" onClose={onClose}>
      <section>
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">Veículo</h3>
        <div className="mt-2 rounded-2xl bg-slate-50 p-4">
          <p className="text-base font-bold text-navy-900">{VEHICLE_PROFILE.label}</p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Velocidade máxima técnica</dt>
              <dd className="font-semibold text-navy-900">{VEHICLE_PROFILE.technicalTopSpeedKmh} km/h</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Velocidade de referência (ETA)</dt>
              <dd className="font-semibold text-navy-900">{VEHICLE_PROFILE.maxOperationalSpeedKmh} km/h</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Autonomia estimada</dt>
              <dd className="font-semibold text-navy-900">≈{VEHICLE_PROFILE.estimatedRangeKm} km</dd>
            </div>
          </dl>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          A capacidade técnica não autoriza automaticamente vias inadequadas — as regras de circulação continuam
          avaliando cada via independente da velocidade configurada.
        </p>
      </section>

      <section className="mt-6">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">Estilo de rota recomendada</h3>
        <div className="mt-2 flex flex-col gap-2">
          {ROUTE_PREFERENCE_OPTIONS.map((option) => {
            const isSelected = preferences.routePreference === option.key
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => selectPreference(option.key)}
                className={`rounded-2xl border p-3 text-left ${
                  isSelected ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white active:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-navy-900">{option.label}</span>
                  {isSelected && <span className="text-xs font-bold text-brand-700">✓ Selecionado</span>}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{option.description}</p>
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Isso influencia qual rota é recomendada entre as elegíveis — nunca libera uma via que a classificação
          considera inadequada.
        </p>
      </section>
    </Panel>
  )
}
