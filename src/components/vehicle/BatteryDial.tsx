import { useEffect, useRef, useState } from 'react'

/**
 * Controle de porcentagem de bateria.
 *
 * POR QUE UM SLIDER E NÃO UM CAMPO NUMÉRICO. Ninguém sabe que está com 63%.
 * Sabe que está "mais ou menos na metade", "quase cheia", "no fim". Um campo
 * numérico pede uma precisão que o usuário não tem e transforma uma
 * aproximação de um segundo num ato de digitação — que é exatamente a
 * burocracia que esta etapa existe para evitar.
 *
 * Passo de 5 pelo mesmo motivo: a diferença entre 63% e 65% não muda nenhuma
 * decisão que este app toma, e fingir que muda seria falsa precisão sobre uma
 * estimativa que já é linear e aproximada.
 */
const STEP = 5

interface BatteryDialProps {
  value: number
  onChange: (percent: number) => void
  /** Autonomia máxima do veículo, para traduzir a porcentagem em km na hora. */
  rangeKm: number
}

export function BatteryDial({ value, onChange, rangeKm }: BatteryDialProps) {
  const km = (value / 100) * rangeKm

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[34px] font-extrabold leading-none text-content-primary">{value}%</span>
        {/*
          O QUILÔMETRO ao lado da porcentagem, sempre.

          Porcentagem é a unidade que o usuário lê no veículo; quilômetro é a
          unidade em que ele pensa o trajeto. Mostrar as duas juntas é o que
          torna o controle uma decisão informada em vez de um número abstrato —
          "40%" não diz nada, "40% · 16 km" diz se dá para ir e voltar.
        */}
        <span className="text-[15px] font-bold text-content-secondary">≈ {formatKm(km)}</span>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        step={STEP}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label="Bateria atual do veículo"
        aria-valuetext={`${value} por cento, cerca de ${formatKm(km)}`}
        className="mt-3 h-11 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-2.5 [&::-webkit-slider-runnable-track]:rounded-pill [&::-webkit-slider-runnable-track]:bg-hairline/[.16] [&::-webkit-slider-thumb]:mt-[-9px] [&::-webkit-slider-thumb]:h-7 [&::-webkit-slider-thumb]:w-7 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-pill [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-brand-500 [&::-webkit-slider-thumb]:shadow-float [&::-moz-range-thumb]:h-7 [&::-moz-range-thumb]:w-7 [&::-moz-range-thumb]:rounded-pill [&::-moz-range-thumb]:border-4 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-brand-500 [&::-moz-range-track]:h-2.5 [&::-moz-range-track]:rounded-pill [&::-moz-range-track]:bg-hairline/[.16]"
        style={{
          background: 'transparent',
        }}
      />

      {/* Atalhos para os três estados que as pessoas realmente relatam. */}
      <div className="mt-1 flex gap-2">
        {[25, 50, 75, 100].map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onChange(preset)}
            className={`flex-1 rounded-pill py-2 text-[13px] font-bold transition-all duration-fast active:scale-[.97] ${
              value === preset
                ? 'bg-brand-500 text-content-on-accent'
                : 'border border-hairline/[.14] bg-surface-tile text-content-secondary'
            }`}
          >
            {preset}%
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Barra fina de bateria — versão de leitura, sem controle.
 *
 * Usada onde a bateria é informação e não decisão (barra do veículo, cabeçalho
 * do modo explorar).
 */
export function BatteryGauge({ percent, className = '' }: { percent: number; className?: string }) {
  const tone = percent <= 15 ? 'bg-danger-500' : percent <= 35 ? 'bg-warning-500' : 'bg-success-500'
  return (
    <span className={`flex h-1.5 w-full overflow-hidden rounded-pill bg-surface-tile ${className}`}>
      <span className={`h-full rounded-pill ${tone}`} style={{ width: `${Math.max(2, percent)}%` }} />
    </span>
  )
}

/**
 * Hook de valor local com sincronização.
 *
 * O slider precisa responder ao dedo em 60 fps; gravar no localStorage a cada
 * pixel arrastado não. O valor vive local enquanto o dedo está na tela e sobe
 * uma vez quando ele sai — sem isso, cada arrasto dispara dezenas de escritas
 * e um re-render do app inteiro por escrita.
 */
export function useDeferredPercent(initial: number, onCommit: (value: number) => void) {
  const [value, setValue] = useState(initial)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => setValue(initial), [initial])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const change = (next: number) => {
    setValue(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => onCommit(next), 220)
  }

  return [value, change] as const
}

function formatKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(km < 10 ? 1 : 0)} km`
}
