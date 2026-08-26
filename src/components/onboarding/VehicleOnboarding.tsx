import { useState } from 'react'
import { BatteryDial } from '@/components/vehicle/BatteryDial'
import { Button } from '@/components/ui/Button'
import { mobilityProfile } from '@/config/mobilityProfiles'
import { speedAdjustedRangeKm } from '@/services/vehicle/autonomy'
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
  /*
    NULL = CAMPO VAZIO, e é um estado legítimo.

    A pergunta continua obrigatória — "Continuar" fica desabilitado enquanto
    faltar resposta —, mas apagar o número para digitar outro é parte normal de
    responder, não uma tentativa de burlar o formulário. Ver NumberField.
  */
  const [rangeKm, setRangeKm] = useState<number | null>(preferences.rangeKm)
  const [speedKmh, setSpeedKmh] = useState<number | null>(preferences.referenceSpeedKmh)
  /**
   * Velocidade em que a autonomia informada vale.
   *
   * Muda com o PRESET (é o número de catálogo do modelo) e NÃO muda quando o
   * usuário ajusta a velocidade em que ele anda — é justamente a diferença
   * entre as duas que permite corrigir a autonomia de um veículo destravado.
   */
  const [ratedSpeedKmh, setRatedSpeedKmh] = useState(preferences.ratedSpeedKmh)
  const [battery, setBattery] = useState(preferences.batteryPercent ?? 80)

  /** A pergunta é obrigatória: sem os dois números não dá para continuar. */
  const completo = rangeKm != null && speedKmh != null

  const selectPreset = (id: VehicleModelId) => {
    // Tocar no veículo JÁ selecionado não faz nada. Sem isto, um toque
    // acidental no card apaga os números que a pessoa acabou de digitar — e
    // "confirmar" a escolha atual é um gesto natural, ninguém espera que ele
    // destrua algo.
    if (id === modelId) return

    setModelId(id)
    // Trocar de veículo TROCA os números para os de catálogo daquele modelo, e
    // isso é o certo: são outro veículo e outras especificações. O que não pode
    // é o caminho inverso — editar número trocando de veículo.
    const preset = VEHICLE_PRESETS.find((entry) => entry.id === id)
    if (preset) {
      setRangeKm(preset.rangeKm)
      setSpeedKmh(preset.topSpeedKmh)
      setRatedSpeedKmh(preset.topSpeedKmh)
    }
  }

  const finish = (withBattery: boolean) => {
    // Só é alcançável com os dois preenchidos (ver `completo`), mas o `??`
    // mantém o tipo honesto em vez de afirmar com `!` algo que o tipo não
    // garante.
    onFinish({
      vehicleModelId: modelId,
      rangeKm: rangeKm ?? preferences.rangeKm,
      referenceSpeedKmh: speedKmh ?? preferences.referenceSpeedKmh,
      ratedSpeedKmh,
      onboardingCompletedAt: Date.now(),
      ...(withBattery
        ? { batteryPercent: battery, batteryUpdatedAt: Date.now(), batteryDistanceSinceUpdateMeters: 0 }
        : {}),
    })
  }

  return (
    <div className="absolute inset-0 z-[60] flex flex-col bg-surface px-gutter pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] pt-[max(2rem,var(--safe-top))]">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {step === 'vehicle' ? (
          <VehicleStep
            modelId={modelId}
            rangeKm={rangeKm}
            speedKmh={speedKmh}
            ratedSpeedKmh={ratedSpeedKmh}
            onSelect={selectPreset}
            /*
              AJUSTAR OS NÚMEROS NÃO TROCA O VEÍCULO.

              Bug relatado: escolher "Scooter elétrica", trocar a autonomia de
              40 para 120 (o valor real do veículo do usuário) DESMARCAVA a
              scooter. Aí, ao remarcá-la, os 120 voltavam para 40 — não havia
              como dizer "tenho uma scooter, e a minha faz 120 km".

              E o estrago passava da tela: `custom` herda o perfil de mobilidade
              da SCOOTER (ver mobilityProfiles). Um usuário de PATINETE que
              mexesse na autonomia virava `custom` e passava a ser roteado com
              as regras da scooter, onde avenida arterial é `caution` em vez de
              `unsuitable`. Ou seja, ajustar um número desligava silenciosamente
              a proteção que é a razão de existir do app.

              O tipo do veículo e os números do veículo são coisas diferentes: o
              tipo decide em que vias ele pode andar, os números descrevem
              aquela unidade específica. Editar um nunca deve mexer no outro.
            */
            onRangeChange={(value) => {
              setRangeKm(value)
              // Autonomia digitada à mão vale para a velocidade que ele anda:
              // o número veio da experiência dele, não do catálogo.
              if (speedKmh != null) setRatedSpeedKmh(speedKmh)
            }}
            onSpeedChange={setSpeedKmh}
          />
        ) : (
          <BatteryStep battery={battery} rangeKm={rangeKm ?? preferences.rangeKm} onChange={setBattery} />
        )}
      </div>

      <div className="shrink-0 pt-4">
        {step === 'vehicle' ? (
          <>
            <Button variant="primary" size="lg" disabled={!completo} onClick={() => setStep('battery')}>
              Continuar
            </Button>
            {/*
              A razão de o botão estar desabilitado, dita em vez de deixada para
              o usuário descobrir. Um botão apagado sem explicação é um beco.
            */}
            {!completo && (
              <p className="mt-2 text-center text-[13px] font-bold text-content-tertiary">
                Preencha autonomia e velocidade para continuar.
              </p>
            )}
          </>
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
  ratedSpeedKmh,
  onSelect,
  onRangeChange,
  onSpeedChange,
}: {
  modelId: VehicleModelId
  rangeKm: number | null
  speedKmh: number | null
  ratedSpeedKmh: number
  onSelect: (id: VehicleModelId) => void
  onRangeChange: (value: number | null) => void
  onSpeedChange: (value: number | null) => void
}) {
  // Só aparece quando há de fato diferença entre as duas velocidades.
  // Só compara quando os dois números existem — com o campo vazio não há o que
  // ajustar, e a frase some junto em vez de mostrar NaN.
  const ajustada =
    rangeKm != null && speedKmh != null && Math.abs(speedKmh - ratedSpeedKmh) >= 3
      ? speedAdjustedRangeKm({ rangeKm, ratedSpeedKmh, referenceSpeedKmh: speedKmh } as UserPreferences)
      : null

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
          <NumberField label="Velocidade" unit="km/h" value={speedKmh} min={6} max={90} onChange={onSpeedChange} />
        </div>

        {/*
          O EFEITO DA VELOCIDADE, dito na hora em que ele é criado.

          Muita gente destrava o veículo. Quem faz isso continua vendo a
          autonomia da caixa — que foi medida na velocidade limitada — e sai
          contando com uma distância que não existe. Mostrar a correção AQUI,
          enquanto o número está sendo digitado, é o único momento em que ela
          muda uma decisão.
        */}
        {ajustada != null && (
          <p className="mt-2.5 text-[12.5px] font-bold leading-snug text-warning-text">
            Andando a {speedKmh} km/h, a autonomia real fica em torno de{' '}
            <strong className="font-extrabold">{Math.round(ajustada)} km</strong> — os {rangeKm} km valem a{' '}
            {ratedSpeedKmh} km/h. O app ajusta sozinho conforme mede seus trajetos.
          </p>
        )}

        {speedKmh != null && speedKmh > 32 && (
          <p className="mt-2 text-[12.5px] font-semibold leading-snug text-content-tertiary">
            Acima de 32 km/h o veículo deixa de se enquadrar como autopropelido, e as regras de
            circulação são outras — as rotas continuam sendo traçadas pelo perfil escolhido acima.
          </p>
        )}
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

/**
 * Campo numérico que se deixa APAGAR.
 *
 * BUG REAL QUE ISTO CONSERTA, e ele tornava o campo praticamente inutilizável.
 * A versão anterior aplicava `Math.max(min, Math.min(max, n))` a cada tecla.
 * Apagar tudo produz string vazia, `Number('')` é 0, e 0 é finito — então o
 * campo, em vez de ficar em branco, grudava no MÍNIMO (5 km e 6 km/h). A partir
 * daí cada dígito digitado se concatenava com o número preso: digitar "10" num
 * campo travado em 6 dava 610, que o clamp então cortava para o máximo, 90.
 *
 * A CAUSA DE FUNDO é validar durante a DIGITAÇÃO. Um número em construção é
 * quase sempre inválido — "" e "1" são estados legítimos no caminho para "120"
 * — e corrigi-los na hora impede o usuário de chegar ao valor que ele quer.
 *
 * Aqui o campo guarda TEXTO enquanto está sendo editado, aceita vazio, e só
 * ajusta à faixa quando o dedo sai (`onBlur`). A obrigatoriedade continua: em
 * branco, o botão de continuar fica desabilitado — a pergunta tem de ser
 * respondida, mas o caminho até a resposta é livre.
 *
 * `type="text"` com `inputMode="numeric"`, e não `type="number"`: o campo
 * numérico do navegador tem comportamento próprio de incremento, aceita "e" e
 * "-", e em alguns navegadores devolve string vazia para valores que ele julga
 * inválidos — o que reintroduziria exatamente esta classe de bug.
 */
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
  /** null = campo vazio. É um estado válido enquanto se digita. */
  value: number | null
  min: number
  max: number
  onChange: (value: number | null) => void
}) {
  return (
    <label className="flex-1">
      <span className="block text-[12px] font-bold uppercase tracking-wide text-content-tertiary">{label}</span>
      <span className="mt-1 flex items-baseline gap-1 rounded-lg border border-hairline/[.12] bg-surface-tile px-3 py-2">
        <input
          type="text"
          inputMode="numeric"
          value={value == null ? '' : String(value)}
          onChange={(event) => {
            const texto = event.target.value.replace(/\D/g, '')
            if (texto === '') {
              onChange(null)
              return
            }
            // Sem clamp aqui: "1" a caminho de "120" não pode virar o mínimo.
            // O ajuste à faixa acontece no blur.
            onChange(Number(texto))
          }}
          onBlur={() => {
            if (value == null) return
            const ajustado = Math.max(min, Math.min(max, value))
            if (ajustado !== value) onChange(ajustado)
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
