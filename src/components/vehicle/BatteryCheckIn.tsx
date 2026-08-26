import { useState } from 'react'
import { BatteryDial } from '@/components/vehicle/BatteryDial'

/**
 * Faixa de confirmação de bateria, na abertura do app.
 *
 * DOIS ESTADOS, e a diferença entre eles é o ponto todo:
 *
 *   1. PERGUNTA — "Ainda está em 80%?" com [Sim] e [Mudou]. Um toque encerra.
 *   2. AJUSTE — só para quem respondeu que mudou: aí sim o controle aparece.
 *
 * Quem não andou fora do app resolve em um toque; quem andou informa o novo
 * valor. Ninguém preenche formulário sem precisar, que era a objeção original a
 * perguntar toda vez.
 *
 * A FRASE DE RODAPÉ não é disclaimer decorativo. O app opina sobre alcance a
 * partir deste número, e a pessoa precisa saber que ele não vem do veículo: sem
 * isso, "24 km" parece leitura de painel, e leitura de painel é o tipo de
 * informação em que se confia para decidir se dá para voltar.
 */
interface BatteryCheckInProps {
  percent: number
  rangeKm: number
  onConfirm: () => void
  onUpdate: (percent: number) => void
}

export function BatteryCheckIn({ percent, rangeKm, onConfirm, onUpdate }: BatteryCheckInProps) {
  const [ajustando, setAjustando] = useState(false)
  const [valor, setValor] = useState(percent)

  return (
    <div className="pointer-events-auto rounded-2xl border border-hairline/[.08] bg-surface-overlay px-3.5 py-3 shadow-float backdrop-blur-xl">
      {ajustando ? (
        <>
          <p className="text-[14px] font-extrabold text-content-primary">Quanta bateria agora?</p>
          <div className="mt-2">
            <BatteryDial value={valor} rangeKm={rangeKm} onChange={setValor} />
          </div>
          <button
            type="button"
            onClick={() => onUpdate(valor)}
            className="mt-3 h-11 w-full rounded-lg bg-brand-500 text-[14.5px] font-extrabold text-content-on-accent transition-all duration-fast active:scale-[.97]"
          >
            Salvar
          </button>
        </>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-tile-accent text-brand-500">
              <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
                <rect x="2.5" y="7.5" width="16" height="9" rx="2.5" />
                <path d="M21 11v2" strokeLinecap="round" />
                <rect x="5" y="10" width="7" height="4" rx="1" fill="currentColor" stroke="none" />
              </svg>
            </span>
            <p className="min-w-0 flex-1 text-[14px] font-bold text-content-primary">
              Ainda está em <strong className="font-extrabold">{percent}%</strong>?
            </p>
          </div>

          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={onConfirm}
              className="h-10 flex-1 rounded-pill bg-success-500 text-[14px] font-extrabold text-content-on-accent transition-all duration-fast active:scale-[.97]"
            >
              Sim
            </button>
            <button
              type="button"
              onClick={() => setAjustando(true)}
              className="h-10 flex-1 rounded-pill border border-hairline/[.14] bg-surface-tile text-[14px] font-extrabold text-content-secondary transition-all duration-fast active:scale-[.97]"
            >
              Mudou
            </button>
          </div>

          <p className="mt-2 text-[11.5px] font-semibold leading-snug text-content-tertiary">
            O app não lê a bateria do veículo — a autonomia mostrada é estimada a partir do que você informa.
          </p>
        </>
      )}
    </div>
  )
}
