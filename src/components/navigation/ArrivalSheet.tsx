import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { formatDistance, formatEta } from '@/utils/geo'

/**
 * Tela de finalização do percurso.
 *
 * Aparece quando o GPS detecta a chegada — depois de a navegação encerrar e do
 * aviso de voz, não no lugar deles.
 *
 * O QUE ELA NÃO FAZ, e é deliberado: nada aqui é enviado, salvo ou processado.
 * A avaliação existe como experiência de encerramento nesta versão; guardar a
 * resposta sem ter o que fazer com ela seria acumular dado sem propósito. Se um
 * dia houver destino para essa informação, o ponto de saída é `onFinish`, que
 * já recebe o que o usuário marcou.
 */

/**
 * Percepções rápidas do trajeto.
 *
 * Quatro, e escritas na primeira pessoa do que se sente ao chegar — não em
 * jargão de classificação. "Trajeto adequado" é o vocabulário do app;
 * "Foi tranquilo" é o vocabulário de quem acabou de descer do veículo.
 *
 * Duas positivas e duas negativas, para a escolha não ser enviesada pela
 * ordem.
 */
const QUICK_FEEDBACK = [
  { id: 'tranquilo', label: 'Foi tranquilo' },
  { id: 'bom-caminho', label: 'Bom caminho' },
  { id: 'transito-pesado', label: 'Trânsito pesado' },
  { id: 'via-ruim', label: 'Via ruim para o veículo' },
] as const

export interface ArrivalFeedback {
  stars: number | null
  quick: string | null
}

interface ArrivalSheetProps {
  destinationLabel: string | null
  distanceMeters: number
  durationMinutes: number
  onFinish: (feedback: ArrivalFeedback) => void
}

/** Duração da saída — casa com `duration-slow` dos tokens. */
const EXIT_MS = 320

export function ArrivalSheet({ destinationLabel, distanceMeters, durationMinutes, onFinish }: ArrivalSheetProps) {
  const [stars, setStars] = useState<number | null>(null)
  const [quick, setQuick] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Entra deslizando no quadro seguinte — no mesmo quadro em que monta, a
    // transição não roda e a folha aparece de estalo.
    const frame = requestAnimationFrame(() => setVisible(true))
    return () => {
      cancelAnimationFrame(frame)
      if (exitTimer.current) clearTimeout(exitTimer.current)
    }
  }, [])

  const finish = () => {
    if (exitTimer.current) return
    setLeaving(true)
    exitTimer.current = setTimeout(() => onFinish({ stars, quick }), EXIT_MS)
  }

  return (
    <>
      {/*
        Aqui O SCRIM EXISTE, ao contrário da comparação de rotas. A diferença é
        de propósito: lá o usuário precisava mexer no mapa para comparar
        traçados; aqui o percurso acabou e não há nada atrás para consultar. O
        escurecimento marca o fim do trajeto.
      */}
      <div
        className={`pointer-events-auto absolute inset-0 z-40 bg-[rgba(15,23,41,.32)] backdrop-blur-[2px] transition-opacity duration-slow ${
          visible && !leaving ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <div
        role="dialog"
        aria-label="Percurso concluído"
        className={`pointer-events-auto absolute inset-x-3 bottom-0 z-50 rounded-t-2xl bg-surface-card px-card pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-6 shadow-sheet transition-all duration-slow ease-ease-out-soft ${
          visible && !leaving ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
        }`}
      >
        <div className="flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-pill bg-success-500/[.16] text-success-600">
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>

          <h2 className="mt-3.5 text-sheet-title text-content-primary">Você chegou!</h2>
          {destinationLabel && (
            <p className="mt-1 max-w-full truncate text-[14px] font-semibold text-content-secondary">{destinationLabel}</p>
          )}

          {/* Números REAIS do percurso — é o resumo que dá sentido ao encerramento. */}
          <p className="mt-2 text-[13.5px] font-bold text-content-tertiary">
            {formatDistance(distanceMeters)} · {formatEta(durationMinutes)}
          </p>
        </div>

        <div className="mt-5">
          <p className="text-center text-[13px] font-bold text-content-secondary">Como foi o trajeto?</p>
          <StarRating value={stars} onChange={setStars} />
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {QUICK_FEEDBACK.map((option) => {
            const active = quick === option.id
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={active}
                // Tocar de novo DESMARCA: sem isso, um toque acidental fica
                // preso e o usuário só sai dele escolhendo outra coisa que não
                // pensa.
                onClick={() => setQuick(active ? null : option.id)}
                className={`rounded-pill px-3.5 py-2 text-[13px] font-bold transition-all duration-fast active:scale-[.97] ${
                  active
                    ? 'bg-brand-500 text-content-on-accent'
                    : 'border border-hairline/[.14] bg-surface-tile text-content-secondary'
                }`}
              >
                {option.label}
              </button>
            )
          })}
        </div>

        <Button className="mt-5" onClick={finish}>
          Concluir
        </Button>
      </div>
    </>
  )
}

/**
 * Cinco estrelas.
 *
 * `role="radiogroup"` e não cinco botões soltos: é uma nota única, e o leitor
 * de tela precisa anunciar "3 de 5" em vez de cinco botões sem relação. Tocar
 * na estrela já marcada zera a nota, pelo mesmo motivo dos chips.
 */
function StarRating({ value, onChange }: { value: number | null; onChange: (value: number | null) => void }) {
  return (
    <div role="radiogroup" aria-label="Nota do trajeto" className="mt-2 flex items-center justify-center gap-1.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = value != null && star <= value
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} ${star === 1 ? 'estrela' : 'estrelas'}`}
            onClick={() => onChange(value === star ? null : star)}
            className="-m-1 flex h-11 w-11 items-center justify-center p-1 transition-all duration-fast active:scale-[.9]"
          >
            <svg
              viewBox="0 0 24 24"
              className={`h-8 w-8 transition-colors duration-fast ${filled ? 'text-warning-500' : 'text-hairline/[.22]'}`}
              fill={filled ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinejoin="round"
            >
              <path d="M12 3.5l2.7 5.6 6.1.8-4.5 4.2 1.2 6-5.5-3-5.5 3 1.2-6L3.2 9.9l6.1-.8L12 3.5Z" />
            </svg>
          </button>
        )
      })}
    </div>
  )
}
