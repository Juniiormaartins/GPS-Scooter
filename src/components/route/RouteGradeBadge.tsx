import type { GradeTone, RouteGradeResult } from '@/services/routing/routeGrade'

/**
 * Selo do grau da rota.
 *
 * PONTO + TEXTO, e não uma pílula colorida cheia. A linha já tem uma pílula —
 * o selo "Recomendada"/"Mais rápida" —, e duas pílulas coloridas lado a lado
 * competem: o olho não sabe qual é o assunto do card. O ponto carrega a cor no
 * mínimo espaço necessário para ser lido de relance, e o peso do texto faz o
 * resto.
 *
 * A cor NUNCA vai sozinha: o rótulo diz a mesma coisa por escrito. É requisito
 * de acessibilidade e também de leitura sob sol, que é a condição real de uso
 * deste app.
 */
const TONE_DOT: Record<GradeTone, string> = {
  good: 'bg-success-500',
  attention: 'bg-warning-500',
  critical: 'bg-danger-500',
  neutral: 'bg-content-tertiary/50',
}

const TONE_TEXT: Record<GradeTone, string> = {
  good: 'text-success-600',
  attention: 'text-warning-text',
  critical: 'text-danger-text',
  neutral: 'text-content-tertiary',
}

export function RouteGradeBadge({ grade }: { grade: RouteGradeResult }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className={`h-[7px] w-[7px] shrink-0 rounded-pill ${TONE_DOT[grade.tone]}`} aria-hidden="true" />
      <span className={`truncate text-[12.5px] font-extrabold ${TONE_TEXT[grade.tone]}`}>{grade.label}</span>
    </span>
  )
}
