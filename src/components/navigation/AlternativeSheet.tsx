import { Button } from '@/components/ui/Button'
import { RouteBreakdown } from '@/components/route/RouteBreakdown'
import { describeComparison, type RouteComparison } from '@/services/routing/alternatives'
import { formatDistance, formatEta } from '@/utils/geo'
import type { ScoredRoute } from '@/types/routing'

/**
 * Sugestão de rota alternativa durante a navegação.
 *
 * A regra que estrutura este componente: a alternativa NUNCA troca sozinha. O
 * usuário está em movimento, muitas vezes já comprometido com uma faixa ou
 * uma conversão — trocar o trajeto sob os pés dele sem aviso é pior do que
 * não oferecer alternativa nenhuma. Aqui ele vê o que muda e decide.
 *
 * O que é mostrado vai além de tempo e distância de propósito: o diferencial
 * deste app é a adequação ao veículo, então a composição por trecho aparece
 * junto — é o que responde "vale a pena pegar 2 min a mais?".
 */
export function AlternativeSheet({
  alternative,
  comparison,
  onAccept,
  onKeep,
}: {
  alternative: ScoredRoute
  comparison: RouteComparison
  onAccept: () => void
  onKeep: () => void
}) {
  const deltas = describeComparison(comparison)
  const isMoreSuitable = comparison.suitabilityDelta > 0

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 rounded-t-2xl border-t border-hairline/15 bg-surface-card px-gutter pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 shadow-sheet">
      <div className="mx-auto mb-3.5 h-[5px] w-14 rounded-pill bg-hairline/20" />

      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-nav-title text-content-primary">Rota alternativa</h2>
        <span className="shrink-0 text-body font-bold text-content-secondary">
          {formatEta(alternative.etaMinutes)} · {formatDistance(alternative.route.totalDistanceMeters)}
        </span>
      </div>

      {/* O veredito em uma linha, antes dos detalhes: é o que o usuário lê no
          semáforo. A cor segue o eixo de adequação, não o de tempo. */}
      <p className={`mt-1.5 text-[16px] font-bold ${isMoreSuitable ? 'text-success-500' : 'text-content-secondary'}`}>
        {isMoreSuitable
          ? 'Mais adequada ao seu veículo que a rota atual.'
          : comparison.suitabilityDelta < 0
            ? 'Menos adequada que a rota atual.'
            : 'Adequação equivalente à rota atual.'}
      </p>

      {deltas.length > 0 && <p className="mt-1 text-caption text-content-secondary">{deltas.join(' · ')}</p>}

      <RouteBreakdown severity={alternative.severity} />

      <div className="mt-gutter flex gap-stack">
        <Button variant="primary" size="lg" onClick={onAccept}>
          Usar esta rota
        </Button>
        <Button variant="secondary" size="lg" onClick={onKeep} className="max-w-[150px]">
          Manter atual
        </Button>
      </div>
    </div>
  )
}
