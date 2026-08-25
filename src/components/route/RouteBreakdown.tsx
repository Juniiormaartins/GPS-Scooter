import { describeRun, type RouteSeverityAnalysis } from '@/services/routing/segmentSeverity'
import { formatDistance } from '@/utils/geo'

/**
 * Explicação da composição da rota: quantos quilômetros de cada nível de
 * adequação ela tem, e onde estão os trechos ruins.
 *
 * Por que isso existe: duas rotas podem ter a mesma classificação geral e
 * serem experiências completamente diferentes — uma com 200 m de rodovia para
 * fazer um retorno, outra com 4 km de acostamento. O selo ("Recomendada") e a
 * nota (81/100) não distinguem os dois casos; a barra e os números distinguem.
 *
 * Os dados vêm prontos de `scoredRoute.severity`, calculado no pipeline com o
 * veículo do perfil. Este componente não classifica nada — só apresenta.
 */

const BAR_COLOR: Record<'suitable' | 'attention' | 'critical', string> = {
  suitable: 'bg-brand-500',
  attention: 'bg-warning-500',
  critical: 'bg-danger-500',
}

export function RouteBreakdown({ severity, compact = false }: { severity: RouteSeverityAnalysis; compact?: boolean }) {
  const { breakdown, runs, isReliable } = severity
  const total = breakdown.totalMeters
  if (total <= 0) return null

  // Sem dado de via, a rota sairia pintada inteiramente como adequada. Dizer
  // isso seria mentir por omissão: o correto é assumir que não sabemos.
  if (!isReliable) {
    return (
      <p className="mt-2 text-caption text-content-tertiary">
        Não foi possível obter os dados das vias desta rota agora — a classificação por trecho não está disponível.
      </p>
    )
  }

  const parts = [
    { key: 'suitable' as const, meters: breakdown.suitableMeters, label: 'adequados' },
    { key: 'attention' as const, meters: breakdown.attentionMeters, label: 'atenção' },
    { key: 'critical' as const, meters: breakdown.criticalMeters, label: 'não recomendado' },
  ].filter((part) => part.meters > 0)

  // Rota inteiramente adequada: uma barra de uma cor só e a lista de trechos
  // vazia não informam nada que o selo já não diga. Uma frase basta.
  const isFullySuitable = parts.length === 1 && parts[0].key === 'suitable'

  return (
    <div className="mt-2.5">
      <div className="flex h-1.5 overflow-hidden rounded-pill bg-surface-tile" role="presentation">
        {parts.map((part) => (
          <span
            key={part.key}
            className={BAR_COLOR[part.key]}
            // Largura proporcional: é a barra que mostra, sem ler número
            // nenhum, que o trecho ruim é uma fatia mínima do percurso.
            style={{ width: `${(part.meters / total) * 100}%` }}
          />
        ))}
      </div>

      <p className="mt-1.5 text-caption text-content-secondary">
        {isFullySuitable ? (
          <>Todos os {formatDistance(total)} em vias adequadas ao seu veículo.</>
        ) : (
          parts.map((part, index) => (
            <span key={part.key}>
              {index > 0 && <span className="text-content-tertiary"> · </span>}
              <span className={part.key === 'suitable' ? '' : 'font-bold'}>
                {formatDistance(part.meters)} {part.label}
              </span>
            </span>
          ))
        )}
      </p>

      {/* Onde estão os trechos ruins. Só na rota selecionada (compact=false):
          nos cards das alternativas isso viraria parede de texto. */}
      {!compact && runs.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {runs.slice(0, 3).map((run) => (
            <li key={`${run.severity}-${run.segmentIndexes[0]}`} className="flex items-start gap-2 text-caption">
              <span
                className={`mt-[5px] h-1.5 w-1.5 shrink-0 rounded-pill ${
                  run.severity === 'critical' ? 'bg-danger-500' : 'bg-warning-500'
                }`}
              />
              <span className="text-content-secondary">{describeRun(run)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
