import { useState } from 'react'
import { Panel } from '@/components/panels/Panel'
import { SectionLabel } from '@/components/ui/primitives'
import { SettingsRow } from '@/components/ui/SettingsRow'
import { VEHICLE_PROFILE } from '@/config/vehicle'
import { getUserPreferences, setUserPreferences, type RoutePreference } from '@/config/userPreferences'
import type { useVehicleBluetooth } from '@/hooks/useVehicleBluetooth'

interface ProfilePanelProps {
  onClose: () => void
  vehicleBluetooth: ReturnType<typeof useVehicleBluetooth>
}

const ROUTE_PREFERENCE_OPTIONS: { key: RoutePreference; label: string }[] = [
  { key: 'tranquil', label: 'Priorizar rotas tranquilas' },
  { key: 'balanced', label: 'Equilibrar tempo e adequação' },
  { key: 'fast', label: 'Priorizar rotas rápidas' },
]

/**
 * Tela "Perfil" na estrutura do handoff: grupos rotulados por eyebrow
 * ("MEU VEÍCULO", "PREFERÊNCIAS DE ROTA", "APARÊNCIA & UNIDADES") e a ação
 * destrutiva por último.
 *
 * Duas diferenças conscientes em relação ao mock, porque o app não tem os
 * dados correspondentes e inventá-los seria mentir na interface:
 * - não há avatar/nome/e-mail: não existe sistema de conta neste app;
 * - "Sair da Conta" não é renderizado pelo mesmo motivo.
 * As preferências de rota continuam sendo as três reais do projeto (elas
 * afetam o ranking em services/routing/index.ts), apresentadas como toggles
 * mutuamente exclusivos.
 */
export function ProfilePanel({ onClose, vehicleBluetooth: bluetooth }: ProfilePanelProps) {
  const [preferences, setPreferences] = useState(getUserPreferences())

  function selectPreference(routePreference: RoutePreference) {
    const next = { ...preferences, routePreference }
    setPreferences(next)
    setUserPreferences(next)
  }

  return (
    <Panel title="Perfil" onClose={onClose}>
      <SectionLabel className="mb-stack">Meu veículo</SectionLabel>
      <div className="flex flex-col gap-stack">
        <SettingsRow label={VEHICLE_PROFILE.label} icon={<ScooterIcon />} control="none" />
        <SettingsRow label="Velocidade de referência" control="value" value={`${VEHICLE_PROFILE.maxOperationalSpeedKmh} km/h`} />
        <SettingsRow label="Autonomia estimada" control="value" value={`≈${VEHICLE_PROFILE.estimatedRangeKm} km`} />
        <BluetoothRow bluetooth={bluetooth} />
      </div>

      <SectionLabel className="mb-stack mt-group">Preferências de rota</SectionLabel>
      <div className="flex flex-col gap-stack">
        {ROUTE_PREFERENCE_OPTIONS.map((option) => (
          <SettingsRow
            key={option.key}
            label={option.label}
            control="toggle"
            checked={preferences.routePreference === option.key}
            onChange={() => selectPreference(option.key)}
          />
        ))}
      </div>
      <p className="mt-3 text-caption text-content-tertiary">
        Influencia qual rota é recomendada entre as elegíveis — nunca libera uma via que a classificação considera
        inadequada.
      </p>

      <SectionLabel className="mb-stack mt-group">Aparência & unidades</SectionLabel>
      <div className="flex flex-col gap-stack">
        <SettingsRow label="Tema da aparência" control="value" value="Escuro" />
        <SettingsRow label="Unidades métricas" control="value" value="Kilômetros (km)" />
      </div>
    </Panel>
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
