import { useEffect, useState } from 'react'
import { Panel } from '@/components/panels/Panel'
import { SectionLabel } from '@/components/ui/primitives'
import { SettingsRow } from '@/components/ui/SettingsRow'
import {
  AVOIDANCE_OPTIONS,
  VEHICLE_PRESETS,
  type AvoidanceId,
  type RoutePreference,
  type UserPreferences,
  type VehicleModelId,
} from '@/config/userPreferences'
import type { useVehicleBluetooth } from '@/hooks/useVehicleBluetooth'
import { isSpeechSupported, listPortugueseVoices, onVoicesChanged } from '@/services/navigation/voiceGuidance'

interface ProfilePanelProps {
  onClose: () => void
  vehicleBluetooth: ReturnType<typeof useVehicleBluetooth>
  preferences: UserPreferences
  onUpdatePreferences: (patch: Partial<UserPreferences>) => void
}

const ROUTE_PREFERENCE_OPTIONS: { key: RoutePreference; label: string }[] = [
  { key: 'tranquil', label: 'Priorizar rotas tranquilas' },
  { key: 'balanced', label: 'Equilibrar tempo e adequação' },
  { key: 'fast', label: 'Priorizar rotas rápidas' },
]

const SPEED_OPTIONS = [20, 25, 32, 40, 45]
const RANGE_OPTIONS = [20, 30, 40, 60, 80]

/**
 * Perfil: grupos rotulados por eyebrow, como no handoff. Todas as
 * configurações aqui têm EFEITO REAL — velocidade de referência alimenta o
 * cálculo de ETA, autonomia alimenta a estimativa de alcance, e o tema
 * repinta o app inteiro. Nada é rótulo decorativo.
 *
 * Não há avatar/nome/e-mail nem "Sair da Conta": o app não tem sistema de
 * conta, e exibir isso seria inventar uma funcionalidade inexistente.
 */
export function ProfilePanel({ onClose, vehicleBluetooth: bluetooth, preferences, onUpdatePreferences }: ProfilePanelProps) {
  const [openPicker, setOpenPicker] = useState<'vehicle' | 'speed' | 'range' | null>(null)

  const currentVehicle = VEHICLE_PRESETS.find((preset) => preset.id === preferences.vehicleModelId)
  const vehicleLabel = currentVehicle?.label ?? 'Personalizado'

  function toggleAvoidance(id: AvoidanceId, next: boolean) {
    const current = preferences.avoidances
    onUpdatePreferences({
      avoidances: next ? [...current, id] : current.filter((entry) => entry !== id),
    })
  }

  /** Trocar de veículo traz junto velocidade e autonomia do preset — é o que torna a escolha significativa. */
  function selectVehicle(id: VehicleModelId) {
    const preset = VEHICLE_PRESETS.find((entry) => entry.id === id)
    if (preset) {
      onUpdatePreferences({ vehicleModelId: preset.id, referenceSpeedKmh: preset.topSpeedKmh, rangeKm: preset.rangeKm })
    }
    setOpenPicker(null)
  }

  return (
    <Panel title="Perfil" onClose={onClose}>
      <SectionLabel className="mb-stack">Meu veículo</SectionLabel>
      <div className="flex flex-col gap-stack">
        <SettingsRow
          label={vehicleLabel}
          icon={<ScooterIcon />}
          control="action"
          action="Alterar"
          onClick={() => setOpenPicker(openPicker === 'vehicle' ? null : 'vehicle')}
        />
        {openPicker === 'vehicle' && (
          <OptionList
            options={VEHICLE_PRESETS.map((preset) => ({
              key: preset.id,
              label: preset.label,
              hint: `${preset.topSpeedKmh} km/h · ≈${preset.rangeKm} km`,
              selected: preset.id === preferences.vehicleModelId,
            }))}
            onSelect={(key) => selectVehicle(key as VehicleModelId)}
          />
        )}

        <SettingsRow
          label="Velocidade de referência"
          control="value"
          value={`${preferences.referenceSpeedKmh} km/h`}
          onClick={() => setOpenPicker(openPicker === 'speed' ? null : 'speed')}
        />
        {openPicker === 'speed' && (
          <OptionList
            options={SPEED_OPTIONS.map((speed) => ({
              key: String(speed),
              label: `${speed} km/h`,
              selected: speed === preferences.referenceSpeedKmh,
            }))}
            onSelect={(key) => {
              onUpdatePreferences({ referenceSpeedKmh: Number(key), vehicleModelId: 'custom' })
              setOpenPicker(null)
            }}
          />
        )}

        <SettingsRow
          label="Autonomia estimada"
          control="value"
          value={`≈${preferences.rangeKm} km`}
          onClick={() => setOpenPicker(openPicker === 'range' ? null : 'range')}
        />
        {openPicker === 'range' && (
          <OptionList
            options={RANGE_OPTIONS.map((range) => ({
              key: String(range),
              label: `≈${range} km`,
              selected: range === preferences.rangeKm,
            }))}
            onSelect={(key) => {
              onUpdatePreferences({ rangeKm: Number(key), vehicleModelId: 'custom' })
              setOpenPicker(null)
            }}
          />
        )}

        <BluetoothRow bluetooth={bluetooth} />
      </div>
      <p className="mt-3 text-caption text-content-tertiary">
        A velocidade de referência é usada no cálculo do tempo estimado das rotas. Ela não autoriza vias inadequadas —
        as regras de circulação continuam avaliando cada via.
      </p>

      <SectionLabel className="mb-stack mt-group">Preferências de rota</SectionLabel>
      <p className="mb-stack text-caption text-content-tertiary">
        Priorize trajetos mais adequados ao seu veículo e às suas preferências.
      </p>
      <div className="flex flex-col gap-stack">
        {ROUTE_PREFERENCE_OPTIONS.map((option) => (
          <SettingsRow
            key={option.key}
            label={option.label}
            control="toggle"
            checked={preferences.routePreference === option.key}
            onChange={() => onUpdatePreferences({ routePreference: option.key })}
          />
        ))}
      </div>

      <SectionLabel className="mb-stack mt-group">Evitar quando possível</SectionLabel>
      <div className="flex flex-col gap-stack">
        {AVOIDANCE_OPTIONS.map((option) => (
          <div key={option.id}>
            <SettingsRow
              label={option.label}
              control="toggle"
              checked={preferences.avoidances.includes(option.id)}
              onChange={(next) => toggleAvoidance(option.id, next)}
            />
            {/* A fonte do dado fica visível na própria opção: é o que separa
                uma preferência sustentada por dado real de um botão bonito. */}
            <p className="mt-1 px-card text-caption text-content-tertiary">{option.description}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-caption text-content-tertiary">
        Estas são preferências, não proibições: o app procura alternativas e só usa um trecho evitado quando ele é
        inevitável ou quando contorná-lo resultaria numa rota desproporcionalmente pior — nesse caso, o trecho aparece
        destacado na rota. As regras obrigatórias do veículo continuam valendo independentemente do que estiver marcado
        aqui.
      </p>

      <SectionLabel className="mb-stack mt-group">Voz das instruções</SectionLabel>
      <VoiceSelector
        selectedUri={preferences.voiceUri}
        onSelect={(voiceUri) => onUpdatePreferences({ voiceUri })}
      />

      <SectionLabel className="mb-stack mt-group">Aparência & unidades</SectionLabel>
      <div className="flex flex-col gap-stack">
        <SettingsRow
          label="Tema escuro"
          control="toggle"
          checked={preferences.theme === 'dark'}
          onChange={(next) => onUpdatePreferences({ theme: next ? 'dark' : 'light' })}
        />
        <SettingsRow label="Unidades métricas" control="value" value="Kilômetros (km)" />
      </div>
    </Panel>
  )
}

/**
 * Escolha da voz. Lista SOMENTE o que `speechSynthesis.getVoices()` reporta
 * neste aparelho — nenhum nome de voz é inventado, e o conjunto muda mesmo
 * entre um iPhone e um Android. Três estados possíveis, todos reais:
 *
 * - navegador sem Web Speech API: diz isso e não oferece controle;
 * - vozes em português carregadas: lista com opção "Automática" no topo;
 * - nenhuma voz em português: informa que o aparelho não tem, em vez de
 *   listar vozes de outro idioma que leriam a instrução errado.
 *
 * A lista chega de forma assíncrona no Chrome/Safari, por isso o
 * `voiceschanged`: sem ele, o primeiro render pega o array vazio e o usuário
 * veria "nenhuma voz" num aparelho que tem várias.
 */
function VoiceSelector({
  selectedUri,
  onSelect,
}: {
  selectedUri: string | null
  onSelect: (voiceUri: string | null) => void
}) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => listPortugueseVoices())

  useEffect(() => {
    if (!isSpeechSupported) return
    setVoices(listPortugueseVoices())
    return onVoicesChanged(() => setVoices(listPortugueseVoices()))
  }, [])

  if (!isSpeechSupported) {
    return <SettingsRow label="Voz" control="value" value="Indisponível neste navegador" />
  }

  if (voices.length === 0) {
    return (
      <>
        <SettingsRow label="Voz" control="value" value="Nenhuma voz em português" />
        <p className="mt-1 px-card text-caption text-content-tertiary">
          Este aparelho não tem voz em português instalada. As instruções continuam aparecendo na tela.
        </p>
      </>
    )
  }

  return (
    <>
      <OptionList
        options={[
          { key: '', label: 'Automática', hint: 'Deixa o app escolher a melhor voz em português', selected: selectedUri == null },
          ...voices.map((voice) => ({
            key: voice.voiceURI,
            label: voice.name,
            hint: voice.lang + (voice.localService ? ' · no aparelho' : ' · online'),
            selected: voice.voiceURI === selectedUri,
          })),
        ]}
        onSelect={(key) => onSelect(key === '' ? null : key)}
      />
      <p className="mt-2 text-caption text-content-tertiary">
        As vozes acima são as que este aparelho tem instaladas. Para ter outras opções, instale vozes em português nas
        configurações do sistema.
      </p>
    </>
  )
}

/** Lista de escolha inline, aberta abaixo da linha que a acionou. */
function OptionList({
  options,
  onSelect,
}: {
  options: { key: string; label: string; hint?: string; selected: boolean }[]
  onSelect: (key: string) => void
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-hairline/10 bg-surface-sunken p-1.5">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onSelect(option.key)}
          className={`flex items-center justify-between rounded-md px-3 py-3 text-left transition-all duration-fast active:scale-[.97] ${
            option.selected ? 'bg-brand-500/[.16]' : 'active:bg-hairline/5'
          }`}
        >
          <span className="min-w-0">
            <span className={`block text-[15px] font-bold ${option.selected ? 'text-brand-500' : 'text-content-primary'}`}>
              {option.label}
            </span>
            {option.hint && <span className="mt-0.5 block text-caption text-content-tertiary">{option.hint}</span>}
          </span>
          {option.selected && (
            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-brand-500" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M5 12l4 4 10-10" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      ))}
    </div>
  )
}

/**
 * Estado real da conexão Bluetooth. Nunca mostra bateria sem leitura de
 * verdade — `unsupported` é o caso mais comum (iOS/Safari não tem Web
 * Bluetooth); dizer isso é melhor que esconder a opção.
 */
function BluetoothRow({ bluetooth }: { bluetooth: ReturnType<typeof useVehicleBluetooth> }) {
  if (bluetooth.status === 'unsupported') {
    return <SettingsRow label="Conexão Bluetooth" control="value" value="Indisponível neste navegador" />
  }

  if (bluetooth.status === 'connected') {
    return (
      <SettingsRow
        label={bluetooth.deviceName ? `Conectado · ${bluetooth.deviceName}` : 'Conectado via Bluetooth'}
        icon={<BluetoothIcon />}
        control="value"
        value={bluetooth.batteryPercent != null ? `${bluetooth.batteryPercent}%` : 'Sem telemetria'}
        onClick={bluetooth.disconnect}
      />
    )
  }

  return (
    <SettingsRow
      label={bluetooth.status === 'connecting' ? 'Conectando…' : 'Conectar veículo'}
      icon={<BluetoothIcon />}
      control="action"
      action="Conectar"
      onClick={bluetooth.connect}
    />
  )
}

const ICON = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

function ScooterIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" {...ICON}>
      <circle cx="6" cy="17" r="2.5" />
      <circle cx="17" cy="17" r="2.5" />
      <path d="M6 17h6l3-8h3M9 9h4l2 4" />
    </svg>
  )
}

function BluetoothIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" {...ICON}>
      <path d="M6.5 6.5l11 11L12 22V2l5.5 5.5L6.5 17.5" />
    </svg>
  )
}
