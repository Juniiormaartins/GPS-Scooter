import type { RouteSeverityAnalysis } from '@/services/routing/segmentSeverity'
import { formatDistance } from '@/utils/geo'

/**
 * `SuitabilityBar` (handoff §5.1): barra de blocos arredondados de 9px com gap
 * de 3px, proporcionais ao trajeto, nas cores verde/âmbar/vermelho.
 *
 * Blocos e não uma barra contínua de propósito: a leitura que importa é
 * "quanto do trajeto é de cada tipo", e blocos discretos comunicam proporção
 * mais rápido do que faixas coladas — além de tolerarem trechos minúsculos,
 * que numa barra contínua virariam uma linha de 1px invisível.
 *
 * Quando a classificação não tem lastro em dado de via (Overpass sem
 * resposta), a barra não é desenhada: pintar tudo de verde afirmaria que a
 * rota foi avaliada quando ela não foi.
 */

const BLOCK_COUNT = 22

const BLOCK_COLOR = {
  suitable: 'bg-success-500',
  attention: 'bg-warning-500',
  critical: 'bg-danger-500',
} as const

export function SuitabilityBar({ severity }: { severity: RouteSeverityAnalysis }) {
  if (!severity.isReliable) return null

  const { breakdown } = severity
  const total = breakdown.totalMeters
  if (total <= 0) return null

  // Distribui os blocos por proporção, garantindo ao menos UM bloco para
  // qualquer categoria presente — 200 m de trecho crítico em 15 km some no
  // arredondamento, e some justamente a informação que mais importa.
  const share = (meters: number) => (meters <= 0 ? 0 : Math.max(1, Math.round((meters / total) * BLOCK_COUNT)))
  const critical = share(breakdown.criticalMeters)
  const attention = share(breakdown.attentionMeters)
  const suitable = Math.max(0, BLOCK_COUNT - critical - attention)

  const blocks: (keyof typeof BLOCK_COLOR)[] = [
    ...Array<'suitable'>(suitable).fill('suitable'),
    ...Array<'attention'>(attention).fill('attention'),
    ...Array<'critical'>(critical).fill('critical'),
  ]

  return (
    <div
      className="flex items-center gap-[3px]"
      role="img"
      aria-label={`Composição do trajeto: ${formatDistance(breakdown.suitableMeters)} adequados, ${formatDistance(
        breakdown.attentionMeters,
      )} de atenção, ${formatDistance(breakdown.criticalMeters)} não recomendados`}
    >
      {blocks.map((kind, index) => (
        <span key={index} className={`h-[9px] flex-1 rounded-[3px] ${BLOCK_COLOR[kind]}`} />
      ))}
    </div>
  )
}

/**
 * `SuitabilitySummary` (handoff §5.1): linha compacta com quadradinho de 8px
 * na cor + a distância de cada categoria problemática.
 *
 * Só lista o que EXISTE. Uma rota inteiramente adequada não ganha uma linha
 * dizendo "0 m em atenção" — ela ganha uma frase afirmativa curta.
 */
export function SuitabilitySummary({ severity }: { severity: RouteSeverityAnalysis }) {
  if (!severity.isReliable) {
    return (
      <p className="text-[13px] font-semibold text-content-tertiary">
        Dados das vias indisponíveis agora — sem classificação por trecho.
      </p>
    )
  }

  const { breakdown } = severity
  const items = [
    { key: 'attention', meters: breakdown.attentionMeters, dot: 'bg-warning-500', label: 'em atenção' },
    { key: 'critical', meters: breakdown.criticalMeters, dot: 'bg-danger-500', label: 'não recomendados' },
  ].filter((item) => item.meters > 0)

  if (items.length === 0) {
    return (
      <p className="text-[13px] font-semibold text-success-600">
        Todo o trajeto em vias adequadas ao seu veículo.
      </p>
    )
  }

  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-semibold text-content-secondary">
      {items.map((item, index) => (
        <span key={item.key} className="flex items-center gap-1.5">
          {index > 0 && <span className="text-content-tertiary">·</span>}
          <span className={`h-2 w-2 rounded-[2px] ${item.dot}`} />
          {formatDistance(item.meters)} {item.label}
        </span>
      ))}
    </p>
  )
}
