import { RouteGradeBadge } from '@/components/route/RouteGradeBadge'
import { SuitabilityBar, SuitabilitySummary } from '@/components/route/SuitabilityBar'
import { Button } from '@/components/ui/Button'
import { SectionLabel, Tag } from '@/components/ui/primitives'
import { gradeRoute } from '@/services/routing/routeGrade'
import type { AutonomyAssessment } from '@/services/vehicle/autonomy'
import type { Eligibility, ScoredRoute } from '@/types/routing'
import { formatDistance, formatEta } from '@/utils/geo'

const LABEL_TEXT: Record<NonNullable<ScoredRoute['label']>, string> = {
  recommended: 'Recomendada',
  fastest: 'Mais rápida',
  safest: 'Mais tranquila',
}

/** Tom do selo por elegibilidade — verde adequada, âmbar com ressalva, vermelho não recomendada. */
const ELIGIBILITY_TONE: Record<Eligibility, 'go' | 'warn' | 'danger'> = {
  allowed: 'go',
  discouraged: 'warn',
  'not-allowed': 'danger',
}

/** Resumo mínimo com o Bottom Sheet recolhido — só a rota ativa. */
export function RouteSummary({ scoredRoute }: { scoredRoute: ScoredRoute }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-baseline gap-2.5">
        <span className="text-metric text-content-primary">{formatEta(scoredRoute.etaMinutes)}</span>
        <span className="text-body text-content-secondary">{formatDistance(scoredRoute.route.totalDistanceMeters)}</span>
      </div>
      <span className="text-caption text-content-tertiary">arraste para ver opções</span>
    </div>
  )
}

interface RoutePanelProps {
  /** Todas as rotas em ORDEM ESTÁVEL (não reordena ao selecionar — só `activeRouteId` muda). */
  routes: ScoredRoute[]
  activeRouteId: string
  onSelectRoute: (routeId: string) => void
  onStartNavigation: () => void
  onDismiss: () => void
  /**
   * Veredito de autonomia POR ROTA, indexado pelo id.
   *
   * Vem pronto de fora porque depende do estado da bateria, que é do app e não
   * da rota. O painel não calcula autonomia — ele mostra o que já foi decidido,
   * pelo mesmo princípio que faz a classificação por trecho vir pronta no
   * `ScoredRoute` em vez de ser recalculada aqui.
   */
  autonomyByRouteId?: Record<string, AutonomyAssessment>
}

/**
 * Bottom sheet de escolha de rota (tela 3 do handoff): eyebrow "OPÇÕES DE
 * ROTA", os cards de candidata com gap de 12px e, no fim, o CTA verde
 * "Iniciar Navegação" com margem superior de 20px.
 *
 * Cada card traz selo, distância, **o motivo em uma frase** e o ETA em
 * 26px/800 à direita — o "porquê" da classificação é regra do handoff e vem
 * do ruleEngine real (highlights), não de texto fixo.
 */
export function RoutePanel({
  routes,
  activeRouteId,
  onSelectRoute,
  onStartNavigation,
  onDismiss,
  autonomyByRouteId,
}: RoutePanelProps) {
  const activeRoute = routes.find((entry) => entry.route.id === activeRouteId) ?? routes[0]
  if (!activeRoute) return null

  return (
    // Altura total do sheet: só a LISTA rola; o CTA fica ancorado embaixo,
    // sempre visível, sem depender de o usuário rolar até o fim.
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between">
        <SectionLabel>{routes.length > 1 ? 'Opções de rota' : 'Rota'}</SectionLabel>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Fechar opções de rota"
          /*
            ALVO DE TOQUE de 44px. O ícone continua com 20px — o que cresce é a
            área sensível, e o `-m-2.5` devolve o espaço para o layout não se
            mexer. Medido na auditoria: este botão tinha 28×28, bem abaixo do
            mínimo confortável.
          */
          className="-m-2.5 flex h-11 w-11 items-center justify-center p-2.5 text-content-tertiary transition-all duration-fast active:scale-[.97] active:opacity-[.88]"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="-mx-1 mt-stack flex min-h-0 flex-1 flex-col gap-stack overflow-y-auto px-1 pb-2">
        {routes.map((entry) => (
          <RouteOptionCard
            key={entry.route.id}
            scoredRoute={entry}
            isSelected={entry.route.id === activeRouteId}
            autonomy={autonomyByRouteId?.[entry.route.id]}
            onSelect={() => onSelectRoute(entry.route.id)}
          />
        ))}
      </div>

      <Button
        variant="go"
        size="lg"
        onClick={onStartNavigation}
        className="mt-stack shrink-0"
        icon={
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
            <path d="M3 11l18-8-8 18-2-8-8-2z" />
          </svg>
        }
      >
        Iniciar Navegação
      </Button>
    </div>
  )
}

function RouteOptionCard({
  scoredRoute,
  isSelected,
  autonomy,
  onSelect,
}: {
  scoredRoute: ScoredRoute
  isSelected: boolean
  autonomy?: AutonomyAssessment
  onSelect: () => void
}) {
  const tone = ELIGIBILITY_TONE[scoredRoute.eligibility]
  const reason = scoredRoute.highlights[0]
  const grade = gradeRoute(scoredRoute)

  /*
    CARD COMPACTO. A versão anterior dava o mesmo peso a todas as candidatas —
    selo, motivo em 16px, barra e resumo em cada uma —, e com três rotas a
    lista não cabia na tela sem rolar. Comparar exige ver as opções LADO A
    LADO; se é preciso rolar entre elas, a comparação se perde.

    A hierarquia agora é: toda candidata mostra o essencial para comparar
    (tempo, distância, composição do trajeto). Só a SELECIONADA se expande com
    o motivo por extenso e os trechos citados um a um — que é a informação de
    quem já escolheu e quer conferir.
  */
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-3.5 rounded-xl px-3.5 py-3 text-left transition-all duration-base ease-standard active:scale-[.97] ${
        isSelected ? 'border-2 border-brand-500 bg-surface-selected' : 'border border-hairline/[.08] bg-surface-card'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Tag tone={tone}>{scoredRoute.label ? LABEL_TEXT[scoredRoute.label] : 'Alternativa'}</Tag>
          {/*
            O GRAU no lugar do percentual.

            "49% adequada" é uma média, e média esconde concentração: o mesmo
            49% pode ser a cidade toda meio ruim ou 4 km de rodovia no meio de
            um trajeto ótimo. O grau é calculado sobre a EXPOSIÇÃO CRÍTICA (ver
            routeGrade), que é o que de fato decide se dá para ir. O percentual
            não some — continua abaixo, na candidata selecionada.
          */}
          <RouteGradeBadge grade={grade} />
        </div>

        <div className="mt-1 flex items-baseline gap-2.5">
          <span className="text-metric-card text-content-primary">{formatEta(scoredRoute.etaMinutes)}</span>
          <span className="text-[17px] font-semibold text-content-secondary">
            {formatDistance(scoredRoute.route.totalDistanceMeters)}
          </span>
        </div>

        <div className="mt-2">
          <SuitabilityBar severity={scoredRoute.severity} compact={!isSelected} />
        </div>

        {/* Só a selecionada explica: nas outras isso viraria parede de texto. */}
        {isSelected && (
          <>
            <p className="mt-2 text-[13.5px] font-semibold text-content-secondary">{grade.detail}</p>
            {reason && reason !== grade.detail && (
              <p className="mt-1 text-[13px] font-semibold text-content-tertiary">{reason}</p>
            )}
            <div className="mt-1 flex items-center gap-2">
              <SuitabilitySummary severity={scoredRoute.severity} />
              {scoredRoute.severity.isReliable && (
                <span className="shrink-0 text-[12.5px] font-bold text-content-tertiary">
                  · {scoredRoute.suitabilityScore}% adequada
                </span>
              )}
            </div>
            {autonomy && autonomy.verdict !== 'unknown' && (
              <p
                className={`mt-1.5 text-[13px] font-bold ${
                  autonomy.verdict === 'insufficient'
                    ? 'text-danger-text'
                    : autonomy.verdict === 'tight'
                      ? 'text-warning-text'
                      : 'text-success-600'
                }`}
              >
                {autonomy.message}
              </p>
            )}
          </>
        )}
      </div>

      <span
        className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-pill ${
          isSelected ? 'bg-brand-500 text-white' : 'border-2 border-hairline/[.14]'
        }`}
      >
        {isSelected && (
          <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth={3}>
            <path d="M5 12l4 4 10-10" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
    </button>
  )
}
