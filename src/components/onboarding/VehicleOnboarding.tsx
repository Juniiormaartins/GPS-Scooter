import { useState } from 'react'
import { BatteryDial } from '@/components/vehicle/BatteryDial'
import { Button } from '@/components/ui/Button'
import { mobilityProfile } from '@/config/mobilityProfiles'
import { VEHICLE_PRESETS, type UserPreferences, type VehicleModelId } from '@/config/userPreferences'

/**
 * CONFIGURAÇÃO INICIAL DO VEÍCULO.
 *
 * Aparece uma vez, no primeiro uso. Existe porque tudo que diferencia este app
 * de um GPS comum depende de saber QUAL veículo está embaixo do usuário: as
 * regras de via, o cálculo de tempo, a autonomia, os alertas. Sem essa resposta
 * o app teria que adivinhar, e adivinhar aqui significa recomendar uma avenida
 * arterial para um patinete.
 *
 * DUAS TELAS, não cinco. Cada campo a mais é uma pessoa a menos que termina, e
 * o que é realmente indispensável cabe em duas perguntas: qual veículo (que já
 * traz velocidade e autonomia de catálogo) e quanto de bateria agora. Os
 * números vêm preenchidos e podem ser ajustados; ninguém precisa saber a
 * autonomia do próprio patinete para começar a usar o app.
 *
 * A SEGUNDA TELA É PULÁVEL. Bateria é a única informação aqui que muda todo
 * dia, e travar a entrada no app por causa dela transformaria a etapa em
 * pedágio. Sem ela o app funciona igual — só não opina sobre alcance, e diz
 * isso com todas as letras em vez de inventar um número.
 */

interface VehicleOnboardingProps {
  preferences: UserPreferences
  onFinish: (patch: Partial<UserPreferences>) => void
}

type Step = 'vehicle' | 'battery'

export function VehicleOnboarding({ preferences, onFinish }: VehicleOnboardingProps) {
  const [step, setStep] = useState<Step>('vehicle')
  const [modelId, setModelId] = useState<VehicleModelId>(preferences.vehicleModelId)
  const [rangeKm, setRangeKm] = useState(preferences.rangeKm)
  const [speedKmh, setSpeedKmh] = useState(preferences.referenceSpeedKmh)
  const [battery, setBattery] = useState(preferences.batteryPercent ?? 80)

  const selectPreset = (id: VehicleModelId) => {
    setModelId(id)
    const preset = VEHICLE_PRESETS.find((entry) => entry.id === id)
    if (preset) {
      setRangeKm(preset.rangeKm)
      setSpeedKmh(preset.topSpeedKmh)
    }
  }

  const finish = (withBattery: boolean) => {
    onFinish({
      vehicleModelId: modelId,
      rangeKm,
      referenceSpeedKmh: speedKmh,
      onboardingCompletedAt: Date.now(),
      ...(withBattery
        ? { batteryPercent: battery, batteryUpdatedAt: Date.now(), batteryDistanceSinceUpdateMeters: 0 }
        : {}),
    })
  }

  return (
    <div className="absolute inset-0 z-[60] flex flex-col bg-surface px-gutter pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {step === 'vehicle' ? (
          <VehicleStep
            modelId={modelId}
            rangeKm={rangeKm}
            speedKmh={speedKmh}
            onSelect={selectPreset}
            onRangeChange={(value) => {
              setRangeKm(value)
              setModelId('custom')
            }}
            onSpeedChange={(value) => {
              setSpeedKmh(value)
              setModelId('custom')
            }}
          />
        ) : (
          <BatteryStep battery={battery} rangeKm={rangeKm} onChange={setBattery} />
        )}
      </div>

      <div className="shrink-0 pt-4">
        {step === 'vehicle' ? (
          <Button variant="primary" size="lg" onClick={() => setStep('battery')}>
            Continuar
          </Button>
        ) : (
          <>
            <Button variant="go" size="lg" onClick={() => finish(true)}>
              Concluir
            </Button>
            <button
              type="button"
              onClick={() => finish(false)}
              className="mt-2.5 h-11 w-full text-[14px] font-bold text-content-tertiary transition-all duration-fast active:scale-[.97]"
            >
              Informar depois
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function VehicleStep({
  modelId,
  rangeKm,
  speedKmh,
  onSelect,
  onRangeChange,
  onSpeedChange,
}: {
  modelId: VehicleModelId
  rangeKm: number
  speedKmh: number
  onSelect: (id: VehicleModelId) => void
  onRangeChange: (value: number) => void
  onSpeedChange: (value: number) => void
}) {
  return (
    <>
      <h1 className="text-[26px] font-extrabold leading-tight text-content-primary">Qual é o seu veículo?</h1>
      <p className="mt-1.5 text-[14.5px] font-semibold text-content-secondary">
        É o que define quais vias o GPS vai recomendar para você.
      </p>

      <div className="mt-5 flex flex-col gap-2.5">
        {VEHICLE_PRESETS.map((preset) => {
          const isActive = preset.id === modelId
          const profile = mobilityProfile(preset.id)
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelect(preset.id)}
              aria-pressed={isActive}
              className={`w-full rounded-xl px-4 py-3.5 text-left transition-all duration-base active:scale-[.98] ${
                isActive ? 'border-2 border-brand-500 bg-surface-selected' : 'border border-hairline/[.08] bg-surface-card'
              }`}
            >
              <span className="block text-[16px] font-extrabold text-content-primary">{preset.label}</span>
              {/*
                A frase abaixo é gerada do PERFIL REAL de mobilidade, não escrita
                à mão: é a mesma tabela que decide as rotas. Se um dia a regra do
                patinete mudar, este texto muda junto — não vira promessa velha.
              */}
              <span className="mt-0.5 block text-[13px] font-semibold text-content-tertiary">
                {describeProfile(preset.id)} · {preset.topSpeedKmh} km/h · {preset.rangeKm} km
              </span>
              <span className="sr-only">{profile.label}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-6 rounded-xl border border-hairline/[.08] bg-surface-card px-4 py-3.5">
        <p className="text-[13px] font-bold text-content-secondary">
          Ajuste se souber os números do seu — dá para mudar depois no Perfil.
        </p>
        <div className="mt-3 flex gap-3">
          <NumberField label="Autonomia" unit="km" value={rangeKm} min={5} max={200} onChange={onRangeChange} />
          <NumberField label="Velocidade" unit="km/h" value={speedKmh} min={6} max={60} onChange={onSpeedChange} />
        </div>
      </div>
    </>
  )
}

function BatteryStep({
  battery,
  rangeKm,
  onChange,
}: {
  battery: number
  rangeKm: number
  onChange: (value: number) => void
}) {
  return (
    <>
      <h1 className="text-[26px] font-extrabold leading-tight text-content-primary">Quanta bateria agora?</h1>
      <p className="mt-1.5 text-[14.5px] font-semibold text-content-secondary">
        Serve para o GPS avisar se o trajeto cabe na autonomia. Não precisa ser exato.
      </p>

      <div className="mt-7 rounded-xl border border-hairline/[.08] bg-surface-card px-4 py-4">
        <BatteryDial value={battery} rangeKm={rangeKm} onChange={onChange} />
      </div>

      <p className="mt-4 text-[13px] font-semibold text-content-tertiary">
        O app desconta sozinho o que você percorrer e pergunta de novo só quando o dado ficar velho.
      </p>
    </>
  )
}

function NumberField({
  label,
  unit,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  unit: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}) {
  return (
    <label className="flex-1">
      <span className="block text-[12px] font-bold uppercase tracking-wide text-content-tertiary">{label}</span>
      <span className="mt-1 flex items-baseline gap-1 rounded-lg border border-hairline/[.12] bg-surface-tile px-3 py-2">
        <input
          type="number"
          inputMode="numeric"
          value={value}
          min={min}
          max={max}
          onChange={(event) => {
            const next = Number(event.target.value)
            if (Number.isFinite(next)) onChange(Math.max(min, Math.min(max, next)))
          }}
          className="w-full min-w-0 bg-transparent text-[18px] font-extrabold text-content-primary outline-none"
        />
        <span className="shrink-0 text-[12.5px] font-bold text-content-tertiary">{unit}</span>
      </span>
    </label>
  )
}

/**
 * Uma frase por veículo, derivada do que o perfil realmente permite.
 *
 * Lê `wayTiers` em vez de repetir texto: o que distingue os três perfis, do
 * ponto de vista de quem vai escolher, é onde cada um PODE andar.
 */
function describeProfile(id: VehicleModelId): string {
  const tiers = mobilityProfile(id).wayTiers
  if (tiers.cycleway === 'very-good' && tiers.primary === 'unsuitable') return 'Ciclovia e rua tranquila'
  if (tiers.cycleway === 'very-good') return 'Ciclovia e vias urbanas'
  return 'Circula na via com o tráfego'
}
