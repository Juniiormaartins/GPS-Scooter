import { useEffect, useRef, useState } from 'react'
import { SuitabilityBar } from '@/components/route/SuitabilityBar'
import { describeRun } from '@/services/routing/segmentSeverity'
import { describeComparison, type RouteComparison } from '@/services/routing/alternatives'
import { formatDistance, formatEta } from '@/utils/geo'
import type { ScoredRoute } from '@/types/routing'

/**
 * Duração da saída. Casa com `duration-slow` dos tokens — a sheet e a pílula
 * do topo saem juntas, e o desmonte espera as duas terminarem.
 */
const SHEET_EXIT_MS = 320

interface AlternativeSheetProps {
  current: ScoredRoute
  /** TODAS as alternativas distintas, já ordenadas. */
  options: ScoredRoute[]
  /** Comparação de cada opção contra a rota atual, na mesma ordem. */
  comparisons: RouteComparison[]
  /** Id da rota em vigor; null = a atual. A seleção é estado do App, não desta sheet. */
  selectedId: string | null
  /** Tocar num card já troca a rota desenhada no mapa. */
  onSelect: (routeId: string | null) => void
  onDismiss: () => void
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
export function AlternativeSheet({
  current,
  options,
  comparisons,
  selectedId,
  onSelect,
  onDismiss,
}: AlternativeSheetProps) {
  /**
   * SAÍDA AUTOMÁTICA DEPOIS DE ESCOLHER.
   *
   * O fluxo era: escolher a rota → ela é aplicada → e a sheet CONTINUAVA
   * aberta, com a pílula dizendo "navegação pausada". Para voltar a navegar o
   * usuário tinha que achar o "X" lá no topo — em movimento, com o trajeto já
   * decidido. Escolher já é a confirmação; ficar não acrescenta nada.
   *
   * Agora a escolha aplica na hora (o traçado troca no mapa, que é o retorno
   * visual imediato) e a sheet recolhe sozinha. O "X" continua existindo para
   * SAIR SEM TROCAR — que é outra intenção, e essa sim precisa de um gesto
   * explícito.
   */
  const [leaving, setLeaving] = useState(false)
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (exitTimer.current) clearTimeout(exitTimer.current)
    }
  }, [])

  /** Espera a animação terminar antes de desmontar, senão a sheet some de um quadro para o outro. */
  const closeAfterAnimation = () => {
    if (exitTimer.current) return
    setLeaving(true)
    exitTimer.current = setTimeout(onDismiss, SHEET_EXIT_MS)
  }

  const handleCardSelect = (which: string | null) => {
    // Aplica ANTES de animar: a rota tem que trocar no mapa enquanto a sheet
    // ainda está saindo, senão o usuário vê o painel fechar e só depois o
    // traçado mudar, como se fossem duas coisas separadas.
    onSelect(which)
    closeAfterAnimation()
  }

  const [showDetails, setShowDetails] = useState(false)
  /**
   * Sheet recolhida: só os dois cards, sem o rodapé de detalhes. Serve para
   * liberar a metade de baixo do mapa enquanto o usuário compara os traçados —
   * é o mesmo motivo de não haver scrim.
   */
  const [collapsed, setCollapsed] = useState(false)

  const chosen = options.find((option) => option.route.id === selectedId) ?? current

  return (
    <>
      {/*
        NÃO existe scrim cobrindo o mapa aqui.
        
        Antes havia um `<button>` de tela inteira servindo de "toque fora para
        fechar", e ele engolia todo arrasto, pinça e rotação — a tela dizia
        "comparando alternativas" enquanto tornava impossível comparar coisa
        alguma. Comparar trajetos EXIGE mexer no mapa: afastar para ver as duas
        rotas inteiras, aproximar num cruzamento, seguir cada traçado com o
        dedo. Fechar é papel do botão explícito abaixo.
      */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center pt-[max(1rem,var(--safe-top))] transition-all duration-slow ease-ease-out-soft ${
          leaving ? '-translate-y-3 opacity-0' : 'translate-y-0 opacity-100'
        }`}
      >
        <button
          type="button"
          onClick={closeAfterAnimation}
          className="pointer-events-auto flex items-center gap-2 rounded-pill bg-nav-surface px-4 py-2 text-[13px] font-extrabold text-nav-content shadow-float transition-all duration-fast active:scale-[.97]"
        >
          Comparando alternativas · navegação pausada
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div
        className={`pointer-events-auto absolute inset-x-3 bottom-0 z-40 rounded-t-2xl bg-surface-card px-card pb-[max(1.25rem,var(--safe-bottom))] pt-[18px] shadow-sheet transition-all duration-slow ease-ease-out-soft ${
          leaving ? 'translate-y-full opacity-0' : 'translate-y-0 opacity-100'
        }`}
      >
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? 'Expandir comparação' : 'Recolher para ver o mapa'}
          className="mx-auto mb-4 flex h-6 w-full items-center justify-center"
        >
          <span className="h-[5px] w-11 rounded-pill bg-surface-handle" />
        </button>

        <h2 className="text-sheet-title-sm text-content-primary">
          {options.length > 1 ? `${options.length} rotas alternativas` : 'Rota alternativa encontrada'}
        </h2>

        <div className="mt-3.5 flex flex-col gap-2.5">
          <RouteCompareCard
            route={current}
            reason="Rota atual"
            selected={selectedId == null}
            onSelect={() => handleCardSelect(null)}
          />
          {options.map((option, index) => (
            <RouteCompareCard
              key={option.route.id}
              route={option}
              reason={describeReason(comparisons[index], index)}
              selected={selectedId === option.route.id}
              onSelect={() => handleCardSelect(option.route.id)}
              deltas={describeComparison(comparisons[index])}
            />
          ))}
        </div>

        {!collapsed && (
        <>
        {/*
          Rodapé recuado com "Ver detalhes" CENTRALIZADO, como no handoff.
          Expande os TRECHOS da rota escolhida — é a pergunta que sobra depois
          de ver a barra: "onde exatamente está o problema?".
        */}
        <div className="mt-3 rounded-tile bg-surface-sunken px-3.5 py-3">
          <button
            type="button"
            onClick={() => setShowDetails((value) => !value)}
            className="flex w-full items-center justify-center gap-1.5 text-[15px] font-extrabold text-brand-500 transition-all duration-fast active:scale-[.97]"
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
            <ul className="mt-3 flex flex-col gap-1.5">
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
        </>
        )}
      </div>
    </>
  )
}

/**
 * Rótulo do cartão — o que ESTA alternativa oferece em relação à atual.
 *
 * Com mais de uma na tela, "Alternativa" repetido não ajuda a escolher. A
 * frase descreve a troca concreta, e o índice entra só como desempate quando
 * duas oferecem a mesma coisa.
 */
function describeReason(comparison: RouteComparison, index: number): string {
  if (comparison.criticalDeltaMeters <= -50) return 'Menos trecho não recomendado'
  if (comparison.suitabilityDelta > 0) return 'Mais adequada ao seu veículo'
  if (comparison.etaDeltaMinutes < 0) return 'Mais rápida'
  if (comparison.distanceDeltaMeters < 0) return 'Mais curta'
  return `Alternativa ${index + 1}`
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
        selected ? 'border-2 border-brand-500 bg-surface-selected' : 'border border-hairline/[.08] bg-surface-card'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {/* Folha: o handoff a usa como marca de "melhor escolha para o veículo". */}
          <svg viewBox="0 0 24 24" className="h-[15px] w-[15px] shrink-0 text-success-600" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 20A7 7 0 0 1 4 13c0-5 4-9 16-9 0 10-5 16-9 16Z" />
            <path d="M4 20c2-6 6-9 11-10" />
          </svg>
          <span className={`truncate text-[13px] font-bold ${selected ? 'text-brand-500' : 'text-content-secondary'}`}>
            {reason}
          </span>
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
          {route.severity.isReliable ? (
            <SuitabilityBar severity={route.severity} />
          ) : (
            /*
              CLASSIFICAÇÃO A CAMINHO.
              
              A `SuitabilityBar` não desenha sem lastro em dado de via, e com
              razão — pintar tudo de verde afirmaria que a rota foi avaliada.
              Mas não desenhar NADA faz o cartão crescer quando o dado chega, e
              some com a diferença entre "esta rota não tem trecho ruim" e
              "ainda não sabemos". O esqueleto ocupa a mesma altura da barra e
              diz qual dos dois é o caso.
            */
            <div className="flex items-center gap-2" aria-live="polite">
              <div className="flex items-center gap-[3px]" aria-hidden="true">
                {Array.from({ length: 10 }).map((_, i) => (
                  <span key={i} className="h-[9px] w-[9px] rounded-[3px] bg-hairline/[.12]" />
                ))}
              </div>
              <span className="text-[11.5px] font-semibold text-content-tertiary">avaliando vias…</span>
            </div>
          )}
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
