import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import {
  AVOIDANCE_OPTIONS,
  VEHICLE_PRESETS,
  type AvoidanceId,
  type UserPreferences,
  type VehicleModelId,
} from '@/config/userPreferences'

interface VehicleSheetProps {
  preferences: UserPreferences
  onSave: (patch: Partial<UserPreferences>) => void
  onDismiss: () => void
}

/**
 * Seletor de veículo (handoff tela 06): sheet sobre o mapa escurecido, com as
 * três opções de veículo e as preferências de rota.
 *
 * MUDANÇA ESTRUTURAL do handoff: isto deixa de ser uma seção dentro do Perfil
 * e passa a ser uma sheet aberta pela barra de veículo — trocar de veículo é
 * uma decisão de trajeto, e enterrá-la numa tela de configurações fazia o
 * usuário sair do mapa para mexer em algo que muda a rota.
 *
 * O handoff pede dois toggles: "Evitar vias não recomendadas" e "Priorizar
 * ciclovias". O segundo NÃO existe aqui, por decisão registrada: ele
 * dependeria da tag `bicycle=designated`, cuja cobertura em Goiânia é baixa
 * demais para sustentar a promessa — o toggle prometeria um comportamento que
 * o dado não entrega. No lugar dele entra "Evitar vias não pavimentadas", que
 * é a outra preferência com lastro real (tag `surface`).
 *
 * As escolhas só valem ao tocar em "Salvar": mexer no veículo recalcula a
 * rota, e recalcular a cada toque enquanto o usuário compara opções seria
 * trabalho jogado fora.
 */

/** Subconjunto das preferências que esta sheet oferece — as duas com dado confiável por trás. */
const SHEET_AVOIDANCES: AvoidanceId[] = ['express-roads', 'unpaved']

export function VehicleSheet({ preferences, onSave, onDismiss }: VehicleSheetProps) {
  const [vehicleModelId, setVehicleModelId] = useState<VehicleModelId>(preferences.vehicleModelId)
  const [avoidances, setAvoidances] = useState<AvoidanceId[]>(preferences.avoidances)

  function toggle(id: AvoidanceId, next: boolean) {
    setAvoidances((current) => (next ? [...new Set([...current, id])] : current.filter((entry) => entry !== id)))
  }

  function save() {
    const preset = VEHICLE_PRESETS.find((entry) => entry.id === vehicleModelId)
    onSave({
      vehicleModelId,
      avoidances,
      // Trocar de veículo traz junto velocidade e autonomia do preset — é o
      // que torna a escolha significativa em vez de um rótulo.
      ...(preset ? { referenceSpeedKmh: preset.topSpeedKmh, rangeKm: preset.rangeKm } : {}),
    })
  }

  return (
    <>
      {/* Scrim do handoff (§4.5): o mapa continua visível, mas recuado. */}
      <button
        type="button"
        aria-label="Fechar seletor de veículo"
        onClick={onDismiss}
        className="pointer-events-auto absolute inset-0 z-30 bg-[rgba(15,23,41,.28)] backdrop-blur-[2px]"
      />

      <div className="pointer-events-auto absolute inset-x-3 bottom-0 z-40 rounded-t-2xl bg-surface-card px-card pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[18px] shadow-sheet-over-scrim">
        <div className="mx-auto mb-4 h-[5px] w-11 rounded-pill bg-surface-handle" />

        <h2 className="text-sheet-title-sm text-content-primary">Meu veículo</h2>

        <div className="mt-3.5 flex flex-col gap-2.5">
          {VEHICLE_PRESETS.map((preset) => {
            const selected = preset.id === vehicleModelId
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setVehicleModelId(preset.id)}
                className={`flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-left transition-all duration-base ease-standard active:scale-[.97] ${
                  selected
                    ? 'border-2 border-brand-500 bg-surface-selected'
                    : 'border border-hairline/[.08] bg-surface-card'
                }`}
              >
                <span
                  className={`flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-md ${
                    selected ? 'bg-surface-tile-accent text-brand-500' : 'bg-surface-tile text-content-secondary'
                  }`}
                >
                  <VehicleIcon id={preset.id} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-row-name text-content-primary">{preset.label}</span>
                  <span className="mt-0.5 block text-[13px] font-semibold text-content-secondary">
                    {preset.topSpeedKmh} km/h · ≈{preset.rangeKm} km de alcance
                  </span>
                </span>
                <span
                  className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-pill ${
                    selected ? 'bg-brand-500 text-white' : 'border-2 border-hairline/[.14]'
                  }`}
                >
                  {selected && (
                    <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth={3}>
                      <path d="M5 12l4 4 10-10" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
              </button>
            )
          })}
        </div>

        <p className="mt-5 text-eyebrow uppercase text-content-quaternary">Preferências de rota</p>

        <div className="mt-2.5 flex flex-col">
          {SHEET_AVOIDANCES.map((id) => {
            const option = AVOIDANCE_OPTIONS.find((entry) => entry.id === id)
            if (!option) return null
            const checked = avoidances.includes(id)
            return (
              <label
                key={id}
                className="flex cursor-pointer items-center justify-between gap-3 border-b border-hairline/[.06] py-3 last:border-b-0"
              >
                <span className="min-w-0 flex-1 text-[15px] font-bold text-content-primary">{option.label}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={checked}
                  aria-label={option.label}
                  onClick={() => toggle(id, !checked)}
                  className={`relative h-[30px] w-[50px] shrink-0 rounded-pill transition-colors duration-base ease-standard ${
                    checked ? 'bg-brand-500' : 'bg-surface-tile'
                  }`}
                >
                  <span
                    className={`absolute top-[3px] h-6 w-6 rounded-pill bg-white shadow-tile transition-all duration-base ease-standard ${
                      checked ? 'left-[23px]' : 'left-[3px]'
                    }`}
                  />
                </button>
              </label>
            )
          })}
        </div>

        <Button variant="primary" size="lg" onClick={save} className="mt-4">
          Salvar
        </Button>
      </div>
    </>
  )
}

function VehicleIcon({ id }: { id: VehicleModelId }) {
  const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

  if (id === 'ebike-25') {
    return (
      <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" {...stroke}>
        <circle cx="5.5" cy="17" r="3.5" />
        <circle cx="18.5" cy="17" r="3.5" />
        <path d="M5.5 17 10 8h5l3.5 9M9 8h5" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" {...stroke}>
      <circle cx="6" cy="17" r="2.5" />
      <circle cx="17" cy="17" r="2.5" />
      <path d="M6 17h6l3-8h3M9 9h4l2 4" />
    </svg>
  )
}
