import { useEffect, useRef, useState } from 'react'
import { Panel } from '@/components/panels/Panel'
import { SettingsGroup } from '@/components/ui/SettingsGroup'
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
import { AVATAR_ACCEPTED_TYPES, prepareAvatar } from '@/services/avatar'

interface ProfilePanelProps {
  onClose: () => void
  vehicleBluetooth: ReturnType<typeof useVehicleBluetooth>
  preferences: UserPreferences
  onUpdatePreferences: (patch: Partial<UserPreferences>) => void
}

/**
 * Como o app decide entre rotas.
 *
 * É UMA ESCOLHA, e a apresentação agora diz isso. Antes eram três
 * interruptores independentes em que ligar um desligava os outros — um
 * interruptor comunica "posso ter os três", e o comportamento real
 * contradizia a forma. Agora é uma lista de escolha única, o mesmo padrão do
 * veículo, da velocidade e da voz.
 *
 * As descrições saíram de "priorizar X" para o que a escolha significa na
 * prática, porque "equilibrar tempo e adequação" não diz ao usuário o que ele
 * vai receber.
 */
const ROUTE_PREFERENCE_OPTIONS: { key: RoutePreference; label: string; hint: string }[] = [
  { key: 'tranquil', label: 'Mais tranquila', hint: 'Aceita alongar o trajeto para fugir de via movimentada' },
  { key: 'balanced', label: 'Equilibrada', hint: 'Pesa tempo e adequação da via na mesma medida' },
  { key: 'fast', label: 'Mais rápida', hint: 'Prioriza o menor tempo, ainda respeitando as regras do veículo' },
]

const SPEED_OPTIONS = [20, 25, 32, 40, 45]
const RANGE_OPTIONS = [20, 30, 40, 60, 80]

type PickerId = 'vehicle' | 'speed' | 'range' | 'routePreference' | 'voice'

/**
 * Perfil — preferências do usuário, agrupadas por assunto.
 *
 * ORDEM, e o porquê dela: veículo primeiro porque é o que muda TODO o resto
 * (regras de via, ETA, alcance, marcador no mapa); depois como traçar a rota e
 * o que evitar, que são as duas decisões que o usuário revisita; voz e
 * aparência por último, que se ajusta uma vez e não se toca mais.
 *
 * Todas as opções aqui têm EFEITO REAL — velocidade de referência alimenta o
 * cálculo de ETA, autonomia alimenta a estimativa de alcance, o tema repinta o
 * app e o veículo troca o sprite do marcador. Nada é rótulo decorativo, e a
 * linha "Unidades — Kilômetros" que existia foi REMOVIDA por ser exatamente
 * isso: um controle que não controlava nada.
 *
 * Há foto de avatar, mas NÃO há nome, e-mail nem "Sair da conta": o app não
 * tem sistema de conta, e exibir isso seria inventar funcionalidade
 * inexistente. A foto é diferente — é uma preferência local do aparelho, como
 * o tema, e não pressupõe conta nenhuma.
 */
export function ProfilePanel({ onClose, vehicleBluetooth: bluetooth, preferences, onUpdatePreferences }: ProfilePanelProps) {
  const [openPicker, setOpenPicker] = useState<PickerId | null>(null)

  const currentVehicle = VEHICLE_PRESETS.find((preset) => preset.id === preferences.vehicleModelId)
  const vehicleLabel = currentVehicle?.label ?? 'Personalizado'
  const routePreference =
    ROUTE_PREFERENCE_OPTIONS.find((option) => option.key === preferences.routePreference) ?? ROUTE_PREFERENCE_OPTIONS[1]

  const activeAvoidances = preferences.avoidances.length

  const toggle = (id: PickerId) => setOpenPicker((current) => (current === id ? null : id))

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
      <AvatarGroup
        dataUrl={preferences.avatarDataUrl}
        onChange={(avatarDataUrl) => onUpdatePreferences({ avatarDataUrl })}
      />

      <SettingsGroup
        title="Meu veículo"
        footnote="A velocidade de referência alimenta o tempo estimado das rotas; a autonomia, a estimativa de alcance. Nenhuma das duas autoriza vias inadequadas — as regras de circulação continuam avaliando cada via."
      >
        <SettingsRow
          inGroup
          label={vehicleLabel}
          description={`${preferences.referenceSpeedKmh} km/h · ≈${preferences.rangeKm} km de autonomia`}
          icon={<ScooterIcon />}
          control="action"
          action="Alterar"
          expanded={openPicker === 'vehicle'}
          onClick={() => toggle('vehicle')}
        />
        {openPicker === 'vehicle' && (
          <OptionList
            label="Modelo do veículo"
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
          inGroup
          label="Velocidade de referência"
          control="value"
          value={`${preferences.referenceSpeedKmh} km/h`}
          expanded={openPicker === 'speed'}
          onClick={() => toggle('speed')}
        />
        {openPicker === 'speed' && (
          <OptionList
            label="Velocidade de referência"
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
          inGroup
          label="Autonomia estimada"
          control="value"
          value={`≈${preferences.rangeKm} km`}
          expanded={openPicker === 'range'}
          onClick={() => toggle('range')}
        />
        {openPicker === 'range' && (
          <OptionList
            label="Autonomia estimada"
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
      </SettingsGroup>

      <SettingsGroup title="Como traçar rotas">
        <SettingsRow
          inGroup
          label="Prioridade do trajeto"
          description={routePreference.hint}
          control="value"
          value={routePreference.label}
          expanded={openPicker === 'routePreference'}
          onClick={() => toggle('routePreference')}
        />
        {openPicker === 'routePreference' && (
          <OptionList
            label="Prioridade do trajeto"
            options={ROUTE_PREFERENCE_OPTIONS.map((option) => ({
              key: option.key,
              label: option.label,
              hint: option.hint,
              selected: option.key === preferences.routePreference,
            }))}
            onSelect={(key) => {
              onUpdatePreferences({ routePreference: key as RoutePreference })
              setOpenPicker(null)
            }}
          />
        )}
      </SettingsGroup>

      <SettingsGroup
        title={activeAvoidances > 0 ? `Evitar quando possível · ${activeAvoidances}` : 'Evitar quando possível'}
        footnote="São preferências, não proibições: o app procura alternativas e só usa um trecho evitado quando ele é inevitável — e nesse caso o trecho aparece destacado na rota."
      >
        {AVOIDANCE_OPTIONS.map((option) => (
          <SettingsRow
            key={option.id}
            inGroup
            label={option.label}
            // A fonte do dado fica dentro da própria opção: é o que separa uma
            // preferência sustentada por dado real de um botão bonito.
            description={option.description}
            control="toggle"
            checked={preferences.avoidances.includes(option.id)}
            onChange={(next) => toggleAvoidance(option.id, next)}
          />
        ))}
      </SettingsGroup>

      <VoiceGroup
        selectedUri={preferences.voiceUri}
        isOpen={openPicker === 'voice'}
        onToggle={() => toggle('voice')}
        onSelect={(voiceUri) => {
          onUpdatePreferences({ voiceUri })
          setOpenPicker(null)
        }}
      />

      <SettingsGroup title="Aparência">
        <SettingsRow
          inGroup
          label="Tema escuro"
          description="Recomendado para conduzir à noite"
          control="toggle"
          checked={preferences.theme === 'dark'}
          onChange={(next) => onUpdatePreferences({ theme: next ? 'dark' : 'light' })}
        />
      </SettingsGroup>

      <p className="mt-group px-1 text-caption text-content-tertiary">
        Distâncias e velocidades em quilômetros. Dados de via do OpenStreetMap; mapa do MapTiler.
      </p>
    </Panel>
  )
}

/**
 * Foto do avatar.
 *
 * FICA AQUI, e não numa tela própria: é uma preferência do aparelho como o
 * tema e o veículo, e criar um fluxo separado para trocar uma imagem seria
 * cerimônia demais. O toque abre direto o seletor do sistema — no celular ele
 * já oferece câmera e galeria, então não há nada a inventar por cima.
 *
 * A prévia é o próprio avatar, no mesmo círculo em que ele aparece na tela
 * principal: o usuário vê o recorte final antes de sair da tela, em vez de
 * descobrir depois que a foto ficou torta.
 */
function AvatarGroup({ dataUrl, onChange }: { dataUrl: string | null; onChange: (value: string | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setErro(null)
    try {
      onChange(await prepareAvatar(file))
    } catch (falha) {
      // Mensagem REAL do que deu errado (formato não suportado, decodificação
      // falhou), não um "erro ao salvar" genérico.
      setErro(falha instanceof Error ? falha.message : 'Não foi possível usar esta imagem.')
    }
  }

  return (
    <SettingsGroup title="Foto do perfil" footnote={erro ?? undefined}>
      <SettingsRow
        inGroup
        label={dataUrl ? 'Alterar foto' : 'Adicionar foto'}
        description="A imagem é recortada em quadrado e fica salva neste aparelho"
        icon={<AvatarPreview dataUrl={dataUrl} />}
        control="action"
        action={dataUrl ? 'Alterar' : 'Escolher'}
        onClick={() => inputRef.current?.click()}
      />
      {dataUrl && (
        <SettingsRow inGroup label="Remover foto" control="action" action="Remover" onClick={() => onChange(null)} />
      )}
      <input
        ref={inputRef}
        type="file"
        accept={AVATAR_ACCEPTED_TYPES}
        className="hidden"
        onChange={(event) => {
          void handleFile(event.target.files?.[0])
          // Zera o valor para que escolher O MESMO arquivo de novo volte a
          // disparar `change` — sem isto, tentar de novo depois de um erro não
          // faria nada.
          event.target.value = ''
        }}
      />
    </SettingsGroup>
  )
}

/** Mesma moldura circular do avatar da tela principal, para a prévia não mentir sobre o recorte. */
function AvatarPreview({ dataUrl, size = 40 }: { dataUrl: string | null; size?: number }) {
  if (!dataUrl) {
    return (
      <span
        className="flex items-center justify-center rounded-pill bg-surface-sunken text-content-tertiary"
        style={{ width: size, height: size }}
      >
        <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="3.6" />
          <path d="M4.8 20a7.6 7.6 0 0 1 14.4 0" />
        </svg>
      </span>
    )
  }
  return (
    <img
      src={dataUrl}
      alt=""
      aria-hidden="true"
      className="rounded-pill object-cover"
      style={{ width: size, height: size }}
    />
  )
}

/**
 * Voz das instruções — agora recolhida atrás de uma linha, como as demais.
 *
 * Antes a lista de TODAS as vozes do aparelho ficava permanentemente aberta no
 * meio do Perfil. Era a maior massa visual da tela, dedicada ao ajuste que
 * menos se mexe, e usava um padrão de apresentação diferente do resto —
 * enquanto veículo, velocidade e autonomia abriam ao toque.
 *
 * Lista SOMENTE o que `speechSynthesis.getVoices()` reporta neste aparelho.
 * Três estados possíveis, todos reais: sem Web Speech API, com vozes em
 * português, ou sem nenhuma voz em português (informa, em vez de listar vozes
 * de outro idioma que leriam a instrução errado).
 */
function VoiceGroup({
  selectedUri,
  isOpen,
  onToggle,
  onSelect,
}: {
  selectedUri: string | null
  isOpen: boolean
  onToggle: () => void
  onSelect: (voiceUri: string | null) => void
}) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => listPortugueseVoices())

  useEffect(() => {
    if (!isSpeechSupported) return
    setVoices(listPortugueseVoices())
    // A lista chega de forma assíncrona no Chrome/Safari: sem isto, o primeiro
    // render pega o array vazio e o usuário veria "nenhuma voz" num aparelho
    // que tem várias.
    return onVoicesChanged(() => setVoices(listPortugueseVoices()))
  }, [])

  if (!isSpeechSupported) {
    return (
      <SettingsGroup title="Navegação por voz">
        <SettingsRow inGroup label="Voz" control="value" value="Indisponível neste navegador" />
      </SettingsGroup>
    )
  }

  if (voices.length === 0) {
    return (
      <SettingsGroup
        title="Navegação por voz"
        footnote="Este aparelho não tem voz em português instalada. As instruções continuam aparecendo na tela. Para ouvi-las, instale uma voz em português nas configurações do sistema."
      >
        <SettingsRow inGroup label="Voz" control="value" value="Nenhuma voz em português" />
      </SettingsGroup>
    )
  }

  const selected = voices.find((voice) => voice.voiceURI === selectedUri)

  return (
    <SettingsGroup
      title="Navegação por voz"
      footnote="Só aparecem as vozes já instaladas neste aparelho. Para ter outras opções, instale vozes em português nas configurações do sistema."
    >
      <SettingsRow
        inGroup
        label="Voz das instruções"
        control="value"
        value={selected ? selected.name : 'Automática'}
        expanded={isOpen}
        onClick={onToggle}
      />
      {isOpen && (
        <OptionList
          label="Voz das instruções"
          options={[
            {
              key: '',
              label: 'Automática',
              hint: 'Deixa o app escolher a melhor voz em português',
              selected: selectedUri == null,
            },
            ...voices.map((voice) => ({
              key: voice.voiceURI,
              label: voice.name,
              hint: voice.lang + (voice.localService ? ' · no aparelho' : ' · online'),
              selected: voice.voiceURI === selectedUri,
            })),
          ]}
          onSelect={(key) => onSelect(key === '' ? null : key)}
        />
      )}
    </SettingsGroup>
  )
}

/**
 * Lista de escolha ÚNICA, aberta dentro do grupo, abaixo da linha que a
 * acionou.
 *
 * `role="radiogroup"` e não uma lista de botões soltos: é uma escolha entre
 * alternativas mutuamente exclusivas, e o leitor de tela precisa anunciar
 * "opção 2 de 5", não cinco botões sem relação.
 */
function OptionList({
  label,
  options,
  onSelect,
}: {
  label: string
  options: { key: string; label: string; hint?: string; selected: boolean }[]
  onSelect: (key: string) => void
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-1 bg-surface-sunken p-1.5">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          role="radio"
          aria-checked={option.selected}
          onClick={() => onSelect(option.key)}
          className={`flex items-center justify-between gap-3 rounded-md px-3 py-3 text-left transition-all duration-fast active:scale-[.97] ${
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
    return (
      <SettingsRow
        inGroup
        label="Conexão Bluetooth"
        icon={<BluetoothIcon />}
        control="value"
        value="Indisponível neste navegador"
      />
    )
  }

  if (bluetooth.status === 'connected') {
    return (
      <SettingsRow
        inGroup
        label={bluetooth.deviceName ? `Conectado · ${bluetooth.deviceName}` : 'Conectado via Bluetooth'}
        description="Toque para desconectar"
        icon={<BluetoothIcon />}
        control="value"
        value={bluetooth.batteryPercent != null ? `${bluetooth.batteryPercent}%` : 'Sem telemetria'}
        onClick={bluetooth.disconnect}
      />
    )
  }

  return (
    <SettingsRow
      inGroup
      label={bluetooth.status === 'connecting' ? 'Conectando…' : 'Conectar veículo'}
      description="Lê a bateria do veículo, quando ele expõe o serviço padrão"
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
