import { RouteGradeBadge } from '@/components/route/RouteGradeBadge'
import { SuitabilityBar, SuitabilitySummary } from '@/components/route/SuitabilityBar'
import { Button } from '@/components/ui/Button'
import { SectionLabel, Tag } from '@/components/ui/primitives'
import { gradeRoute } from '@/services/routing/routeGrade'
import type { AutonomyAssessment } from '@/services/vehicle/autonomy'
import type { Eligibility, ScoredRoute } from '@/types/routing'
import { formatDistance, formatEta } from '@/utils/geo'
import { Icon } from '@/components/ui/Icon'

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
 * Bottom sheet de escolha de rota.
 *
 * ESTRUTURA: uma FILEIRA de opções para comparar de relance e UM cartão de
 * detalhe da selecionada. A versão anterior empilhava um cartão por rota, cada
 * um do tamanho de um terço da folha; só um cabia sem rolar, e comparar rotas
 * obrigava a rolar entre elas — o contrário do que a escolha pede. O próprio
 * comentário do componente já dizia que "comparar exige ver as opções lado a
 * lado"; a implementação é que não fazia isso.
 *
 * Agora as opções ficam numa linha (tempo, distância e um selo de cor) e o
 * "porquê" da escolhida — grau, trechos, autonomia — aparece uma vez, embaixo.
 * O "porquê" continua vindo do ruleEngine real, não de texto fixo.
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
    // Altura total do sheet: só o MIOLO rola, se precisar; o CTA fica ancorado
    // embaixo, sempre visível, sem depender de o usuário rolar até o fim.
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
            mexer.
          */
          className="-m-2.5 flex h-11 w-11 items-center justify-center p-2.5 text-content-tertiary transition-all duration-fast active:scale-[.97] active:opacity-[.88]"
        >
          <Icon name="close" size={20} strokeWidth={2.2} />
        </button>
      </div>

      <div className="-mx-1 mt-stack flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1 pb-2">
        {routes.length > 1 && (
          <div role="radiogroup" aria-label="Opções de rota" className="-mx-1 flex shrink-0 snap-x gap-2.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {routes.map((entry, index) => (
              <RouteChip
                key={entry.route.id}
                position={index + 1}
                scoredRoute={entry}
                isSelected={entry.route.id === activeRoute.route.id}
                onSelect={() => onSelectRoute(entry.route.id)}
              />
            ))}
          </div>
        )}

        <RouteDetail
          scoredRoute={activeRoute}
          showMetrics={routes.length === 1}
          autonomy={autonomyByRouteId?.[activeRoute.route.id]}
        />
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

const TONE_DOT: Record<'go' | 'warn' | 'danger', string> = {
  go: 'bg-success-500',
  warn: 'bg-warning-500',
  danger: 'bg-danger-500',
}

/** Uma opção na fileira: o mínimo para COMPARAR — tempo, distância e a cor do veredito. */
function RouteChip({
  scoredRoute,
  position,
  isSelected,
  onSelect,
}: {
  scoredRoute: ScoredRoute
  /** Posição na fileira, para numerar as alternativas sem nome. */
  position: number
  isSelected: boolean
  onSelect: () => void
}) {
  const tone = ELIGIBILITY_TONE[scoredRoute.eligibility]
  const label = scoredRoute.label ? LABEL_TEXT[scoredRoute.label] : `Opção ${position}`

  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      onClick={onSelect}
      className={`min-w-[116px] flex-1 shrink-0 snap-start rounded-xl px-3 py-2.5 text-left transition-all duration-base ease-standard active:scale-[.97] ${
        isSelected
          ? 'border-2 border-brand-500 bg-surface-selected shadow-tile'
          : 'border-2 border-transparent bg-surface-sunken'
      }`}
    >
      <span className="flex items-center gap-1.5">
        <span className={`h-2 w-2 shrink-0 rounded-pill ${TONE_DOT[tone]}`} aria-hidden="true" />
        <span className="truncate text-[12px] font-bold text-content-tertiary">{label}</span>
      </span>
      <span className="mt-1 block text-[21px] font-black leading-none tracking-[-0.3px] text-content-primary">
        {formatEta(scoredRoute.etaMinutes)}
      </span>
      <span className="mt-1 block text-[13px] font-semibold text-content-secondary">
        {formatDistance(scoredRoute.route.totalDistanceMeters)}
      </span>
    </button>
  )
}

/** O "porquê" da rota selecionada — aparece UMA vez, em vez de uma por candidata. */
function RouteDetail({
  scoredRoute,
  showMetrics,
  autonomy,
}: {
  scoredRoute: ScoredRoute
  /** Só quando NÃO há fileira de opções: com ela, tempo e distância já estão no chip selecionado. */
  showMetrics: boolean
  autonomy?: AutonomyAssessment
}) {
  const tone = ELIGIBILITY_TONE[scoredRoute.eligibility]
  const reason = scoredRoute.highlights[0]
  const grade = gradeRoute(scoredRoute)

  return (
    <div className="shrink-0 rounded-xl border border-hairline/[.08] bg-surface-card px-4 py-3.5">
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Tag tone={tone}>{scoredRoute.label ? LABEL_TEXT[scoredRoute.label] : 'Alternativa'}</Tag>
          {/*
            O GRAU no lugar do percentual: "49% adequada" é uma média, e média
            esconde concentração — o mesmo 49% pode ser a cidade toda meio ruim
            ou 4 km de rodovia no meio de um trajeto ótimo. O grau é calculado
            sobre a EXPOSIÇÃO CRÍTICA (ver routeGrade).
          */}
          <RouteGradeBadge grade={grade} />
        </div>
      </div>

      {showMetrics && (
        <div className="mt-2 flex items-baseline gap-2.5">
          <span className="text-metric-card text-content-primary">{formatEta(scoredRoute.etaMinutes)}</span>
          <span className="text-[17px] font-semibold text-content-secondary">
            {formatDistance(scoredRoute.route.totalDistanceMeters)}
          </span>
        </div>
      )}

      <div className="mt-2.5">
        <SuitabilityBar severity={scoredRoute.severity} />
      </div>

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
        <span className="ml-auto shrink-0 text-[12.5px] font-bold text-content-tertiary">
          chegada {arrivalTime(scoredRoute.etaMinutes)}
        </span>
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
    </div>
  )
}

/** Hora prevista de chegada, derivada do tempo estimado — 24h. */
function arrivalTime(etaMinutes: number): string {
  return new Date(Date.now() + etaMinutes * 60_000).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}
