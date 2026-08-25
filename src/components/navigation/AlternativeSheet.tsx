import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { SuitabilityBar } from '@/components/route/SuitabilityBar'
import { describeRun } from '@/services/routing/segmentSeverity'
import { describeComparison, type RouteComparison } from '@/services/routing/alternatives'
import { formatDistance, formatEta } from '@/utils/geo'
import type { ScoredRoute } from '@/types/routing'

interface AlternativeSheetProps {
  current: ScoredRoute
  alternative: ScoredRoute
  comparison: RouteComparison
  onAccept: () => void
  onKeep: () => void
}

/**
 * Comparação de rotas durante a navegação (handoff tela 05).
 *
 * Estrutura do handoff: pílula de status escura no topo, e uma sheet com DOIS
 * cards — atual × alternativa —, cada um com o motivo, tempo 24/900 +
 * distância 17/600, `SuitabilityBar` e seletor circular à direita. O
 * selecionado ganha borda azul de 2px e fundo `#F7FBFE`.
 *
 * A regra que estrutura tudo: a alternativa NUNCA troca sozinha. O usuário
 * está em movimento, muitas vezes já comprometido com uma faixa ou conversão
 * — trocar o trajeto sob os pés dele sem aviso é pior do que não oferecer
 * alternativa nenhuma. Aqui ele compara e decide.
 */
export function AlternativeSheet({ current, alternative, comparison, onAccept, onKeep }: AlternativeSheetProps) {
  /** Começa na rota ATUAL: não decidir mantém o que já está sendo seguido. */
  const [selected, setSelected] = useState<'current' | 'alternative'>('current')
  const [showDetails, setShowDetails] = useState(false)

  const chosen = selected === 'current' ? current : alternative
  const deltas = describeComparison(comparison)

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center pt-[max(1rem,env(safe-area-inset-top))]">
        <span className="rounded-pill bg-nav-surface px-4 py-2 text-[13px] font-extrabold text-nav-content shadow-float">
          Comparando alternativas · navegação pausada
        </span>
      </div>

      <div className="pointer-events-auto absolute inset-x-3 bottom-0 z-40 rounded-t-2xl bg-surface-card px-card pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[18px] shadow-sheet">
        <div className="mx-auto mb-4 h-[5px] w-11 rounded-pill bg-[#DCE4EF]" />

        <h2 className="text-sheet-title-sm text-content-primary">Rota alternativa encontrada</h2>

        <div className="mt-3.5 flex flex-col gap-2.5">
          <RouteCompareCard
            route={current}
            reason="Rota atual"
            selected={selected === 'current'}
            onSelect={() => setSelected('current')}
          />
          <RouteCompareCard
            route={alternative}
            reason={
              comparison.suitabilityDelta > 0
                ? 'Mais adequada ao seu veículo'
                : comparison.etaDeltaMinutes < 0
                  ? 'Mais rápida'
                  : 'Alternativa'
            }
            selected={selected === 'alternative'}
            onSelect={() => setSelected('alternative')}
            deltas={deltas}
          />
        </div>

        {/*
          "Ver detalhes" expande os TRECHOS da rota escolhida — é a pergunta
          que sobra depois de ver a barra: "onde exatamente está o problema?".
        */}
        <div className="mt-3 rounded-tile bg-surface-sunken px-3.5 py-2.5">
          <button
            type="button"
            onClick={() => setShowDetails((value) => !value)}
            className="flex w-full items-center justify-between gap-2 text-[14px] font-extrabold text-brand-500 transition-all duration-fast active:scale-[.97]"
          >
            Ver detalhes
            <svg
              viewBox="0 0 24 24"
              className={`h-[18px] w-[18px] transition-transform duration-base ${showDetails ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {showDetails && (
            <ul className="mt-2.5 flex flex-col gap-1.5">
              {chosen.severity.runs.length === 0 ? (
                <li className="text-[13px] font-semibold text-content-secondary">
                  Nenhum trecho de atenção nesta rota.
                </li>
              ) : (
                chosen.severity.runs.slice(0, 4).map((run) => (
                  <li key={`${run.severity}-${run.segmentIndexes[0]}`} className="flex items-start gap-2">
                    <span
                      className={`mt-[6px] h-2 w-2 shrink-0 rounded-[2px] ${
                        run.severity === 'critical' ? 'bg-danger-500' : 'bg-warning-500'
                      }`}
                    />
                    <span className="text-[13px] font-semibold text-content-secondary">{describeRun(run)}</span>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>

        <div className="mt-4 flex gap-2.5">
          <Button variant="secondary" size="md" onClick={onKeep} className="max-w-[150px]">
            Manter atual
          </Button>
          <Button variant="primary" size="md" onClick={selected === 'alternative' ? onAccept : onKeep}>
            {selected === 'alternative' ? 'Trocar rota' : 'Continuar'}
          </Button>
        </div>
      </div>
    </>
  )
}

function RouteCompareCard({
  route,
  reason,
  selected,
  onSelect,
  deltas = [],
}: {
  route: ScoredRoute
  reason: string
  selected: boolean
  onSelect: () => void
  deltas?: string[]
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-left transition-all duration-base ease-standard active:scale-[.97] ${
        selected ? 'border-2 border-brand-500 bg-[#F7FBFE]' : 'border border-hairline/[.08] bg-surface-card'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {/* Folha: o handoff a usa como marca de "melhor escolha para o veículo". */}
          <svg viewBox="0 0 24 24" className="h-[15px] w-[15px] shrink-0 text-success-600" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 20A7 7 0 0 1 4 13c0-5 4-9 16-9 0 10-5 16-9 16Z" />
            <path d="M4 20c2-6 6-9 11-10" />
          </svg>
          <span className="truncate text-[13px] font-bold text-content-secondary">{reason}</span>
        </div>

        <div className="mt-1 flex items-baseline gap-2.5">
          <span className="text-metric-card text-content-primary">{formatEta(route.etaMinutes)}</span>
          <span className="text-[17px] font-semibold text-content-secondary">
            {formatDistance(route.route.totalDistanceMeters)}
          </span>
        </div>

        {deltas.length > 0 && (
          <p className="mt-0.5 truncate text-[12.5px] font-semibold text-content-tertiary">{deltas.join(' · ')}</p>
        )}

        <div className="mt-2">
          <SuitabilityBar severity={route.severity} />
        </div>
      </div>

      <span
        className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-pill ${
          selected ? 'bg-brand-500 text-white' : 'border-2 border-hairline/[.14]'
        }`}
      >
        {selected && (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={3}>
            <path d="M5 12l4 4 10-10" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
    </button>
  )
}
