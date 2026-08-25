import { Button } from '@/components/ui/Button'
import type { SeverityRun } from '@/services/routing/segmentSeverity'
import { formatDistance } from '@/utils/geo'
import type { RouteSegment } from '@/types/routing'

/**
 * Aviso antecipado e detalhe de trecho classificado (handoff telas 04 e 07).
 *
 * O que estes dois componentes NÃO fazem, e por quê:
 *
 * - Não oferecem "desviar por ciclovia". O handoff desenha esse botão com um
 *   delta pronto ("+3 min"), o que exigiria calcular um desvio específico que
 *   contorna ESTE trecho. Nosso roteador devolve rotas inteiras, não desvios
 *   pontuais; e a preferência "priorizar ciclovias" foi deliberadamente
 *   deixada de fora do produto porque a cobertura de `bicycle=designated` em
 *   Goiânia não a sustenta. Em vez de um botão que promete o que não
 *   entregamos, a ação leva à busca de rota alternativa, que é real.
 * - Não inventam limite de velocidade nem "sem ciclovia" quando a tag não
 *   existe: cada métrica só aparece com dado por trás.
 */

interface SegmentWarningPillProps {
  run: SeverityRun
  /** Distância até o início do trecho, ao longo da rota. */
  distanceAheadMeters: number
  onOpen: () => void
}

export function SegmentWarningPill({ run, distanceAheadMeters, onOpen }: SegmentWarningPillProps) {
  const critical = run.severity === 'critical'
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`pointer-events-auto flex w-full items-center gap-2.5 rounded-2xl border bg-surface-overlay px-4 py-2.5 text-left shadow-float backdrop-blur-xl transition-all duration-fast active:scale-[.97] active:opacity-[.88] ${
        critical ? 'border-[rgba(240,69,69,.4)]' : 'border-[rgba(245,166,35,.4)]'
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        className={`h-5 w-5 shrink-0 ${critical ? 'text-danger-text' : 'text-warning-text'}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10.3 3.9 1.8 18.2A2 2 0 0 0 3.5 21h17a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4M12 17h.01" />
      </svg>
      <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-content-primary">
        Em {formatDistance(distanceAheadMeters)}: {formatDistance(run.distanceMeters)}{' '}
        {critical ? 'não recomendados' : 'de atenção'}
      </span>
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0 text-content-tertiary" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  )
}

interface SegmentDetailSheetProps {
  run: SeverityRun
  /** Segmentos da rota, para ler as tags reais do trecho. */
  segments: RouteSegment[]
  onFindAlternative: () => void
  onDismiss: () => void
  isSearchingAlternative: boolean
}

export function SegmentDetailSheet({
  run,
  segments,
  onFindAlternative,
  onDismiss,
  isSearchingAlternative,
}: SegmentDetailSheetProps) {
  const critical = run.severity === 'critical'
  const tags = segments[run.segmentIndexes[0]]?.osmTags
  const maxSpeed = tags?.maxspeed ? Number.parseInt(tags.maxspeed, 10) : null
  const surface = tags?.surface ?? null
  const isHighway = tags?.ref ?? null

  return (
    <>
      <button
        type="button"
        aria-label="Fechar detalhe do trecho"
        onClick={onDismiss}
        className="pointer-events-auto absolute inset-0 z-30 bg-[rgba(15,23,41,.28)] backdrop-blur-[2px]"
      />

      <div className="pointer-events-auto absolute inset-x-3 bottom-0 z-40 rounded-t-2xl bg-surface-card px-card pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[18px] shadow-sheet-over-scrim">
        <div className="mx-auto mb-4 h-[5px] w-11 rounded-pill bg-[#DCE4EF]" />

        <p className="text-eyebrow uppercase text-brand-500">
          {critical ? 'Trecho não recomendado' : 'Trecho que exige atenção'}
        </p>

        <div className="mt-2 flex items-start gap-2.5">
          <span
            className={`mt-2 h-[11px] w-[11px] shrink-0 rounded-pill ${critical ? 'bg-danger-500' : 'bg-warning-500'}`}
          />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sheet-title text-content-primary">{run.roadName ?? 'Trecho da rota'}</h2>
            <p className="mt-1 text-[13.5px] font-semibold text-content-secondary">
              {formatDistance(run.distanceMeters)} no seu trajeto
            </p>
          </div>
        </div>

        {/* Métricas: só as que TÊM dado. Sem a tag, a métrica não aparece. */}
        <div className="mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-2">
          <Metric
            icon={
              <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19h16M6 19V9l6-5 6 5v10" />
              </svg>
            }
            value={formatDistance(run.distanceMeters)}
          />
          {maxSpeed != null && Number.isFinite(maxSpeed) && (
            <Metric
              icon={
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
                  <path d="M13.4 10.6 19 5M3.3 17a9 9 0 1 1 17.4 0" />
                </svg>
              }
              value={`${maxSpeed} km/h`}
              tone={critical ? 'danger' : 'warn'}
            />
          )}
          {isHighway && (
            <Metric
              icon={
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3v18M6 7v10M18 7v10" />
                </svg>
              }
              value={isHighway}
              tone="danger"
            />
          )}
          {surface && (
            <Metric
              icon={
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12h18M3 6h18M3 18h18" />
                </svg>
              }
              value={surface}
            />
          )}
        </div>

        <div className="mt-4">
          <Button variant="primary" size="lg" onClick={onFindAlternative} disabled={isSearchingAlternative}>
            {isSearchingAlternative ? 'Procurando…' : 'Buscar rota alternativa'}
          </Button>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="mt-3 w-full py-1 text-center text-[15px] font-extrabold text-content-secondary transition-all duration-fast active:scale-[.97]"
        >
          Seguir assim
        </button>
      </div>
    </>
  )
}

function Metric({
  icon,
  value,
  tone = 'neutral',
}: {
  icon: React.ReactNode
  value: string
  tone?: 'neutral' | 'warn' | 'danger'
}) {
  const color = {
    neutral: 'text-content-secondary',
    warn: 'text-warning-text',
    danger: 'text-danger-text',
  }[tone]
  return (
    <span className={`flex items-center gap-1.5 text-[14px] font-bold ${color}`}>
      {icon}
      {value}
    </span>
  )
}
