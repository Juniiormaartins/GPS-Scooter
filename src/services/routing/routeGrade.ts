import { REASON_TEXT, type SuitabilityReasonCode } from '@/config/mobilityProfiles'
import type { ScoredRoute } from '@/types/routing'

/**
 * GRAU DA ROTA — um nível só, legível de relance.
 *
 * O app já tinha duas leituras de adequação, e nenhuma das duas responde a
 * pergunta que o usuário faz na hora de escolher:
 *
 *   - `suitabilityScore` ("49% adequada") é uma média ponderada. Média esconde
 *     concentração: 49% pode ser a cidade inteira meio ruim ou 4 km de rodovia
 *     no meio de um trajeto ótimo, e essas duas rotas não se escolhem igual.
 *   - as cores por trecho respondem "onde", não "e daí".
 *
 * O grau responde "e daí": o que domina o veredito é a EXPOSIÇÃO CRÍTICA —
 * quantos metros contínuos em via inadequada — e não a média. É a mesma lógica
 * que já governa o ranking (ver rankRoutes), agora dita em voz alta na
 * interface em vez de ficar implícita na ordem dos cards.
 */
export type RouteGrade = 'excellent' | 'good' | 'attention' | 'poor' | 'unsuitable' | 'unknown'

/**
 * Os rótulos.
 *
 * Vocabulário já usado na tela — "adequada" é a palavra do percentual, "atenção"
 * e "não recomendado" são as palavras dos trechos. O grau não inventa um terceiro
 * idioma; ele nomeia a rota inteira com as palavras que já nomeiam as partes.
 */
export const ROUTE_GRADE_LABEL: Record<RouteGrade, string> = {
  excellent: 'Muito adequada',
  good: 'Adequada',
  attention: 'Exige atenção',
  poor: 'Pouco recomendada',
  unsuitable: 'Não recomendada',
  unknown: 'Sem classificação',
}

/**
 * Cor de cada grau, no vocabulário de severidade que o mapa já usa.
 *
 * Só três cores para seis graus, de propósito: a cor responde "posso ir?" e
 * isso tem três respostas. A distinção fina entre "Muito adequada" e "Adequada"
 * é do TEXTO — pintá-la de dois verdes diferentes obrigaria o usuário a
 * memorizar uma escala em vez de bater o olho.
 */
export type GradeTone = 'good' | 'attention' | 'critical' | 'neutral'

/**
 * Exposição crítica a partir da qual a rota deixa de ser "pouco recomendada" e
 * passa a ser "não recomendada".
 *
 * 1200 m porque é onde a exposição deixa de caber em qualquer explicação de
 * manobra. `SHORT_EXPOSURE_METERS` (400 m, em segmentSeverity) já separou
 * travessia de percurso; o triplo disso é percurso deliberado por via ruim.
 */
const SEVERE_CRITICAL_METERS = 1200
/** Ou, em rota curta, um quinto do trajeto — 1200 m não significa o mesmo em 2 km e em 20 km. */
const SEVERE_CRITICAL_SHARE = 0.2

/** Acima desta fração em trechos de atenção, a rota inteira passa a ser "exige atenção". */
const ATTENTION_SHARE = 0.35
/** Abaixo desta fração, os trechos de atenção são pontuais o bastante para a rota ser "muito adequada". */
const NEGLIGIBLE_ATTENTION_SHARE = 0.1

export interface RouteGradeResult {
  grade: RouteGrade
  label: string
  tone: GradeTone
  /** Uma frase dizendo POR QUE, com o número que sustenta o veredito. */
  detail: string
  criticalMeters: number
  attentionMeters: number
  /** Motivo dominante do pior trecho, quando há um. */
  reason: SuitabilityReasonCode | null
}

export function gradeRoute(scored: ScoredRoute): RouteGradeResult {
  const { severity, eligibility } = scored
  const { criticalMeters, attentionMeters, totalMeters } = severity.breakdown

  const worstRun =
    [...severity.runs].sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1
      return b.distanceMeters - a.distanceMeters
    })[0] ?? null
  const reason = worstRun?.reason ?? null

  /*
    SEM DADO NÃO HÁ GRAU.

    `isReliable` false significa que o Overpass não respondeu e nenhum segmento
    tem tag do OSM — nesse caso todos os trechos saem como adequados por
    AUSÊNCIA de informação. Deixar isso virar "Muito adequada" seria a pior
    mentira que este módulo pode contar, porque é exatamente onde o usuário mais
    confiaria nela.
  */
  if (!severity.isReliable) {
    return {
      grade: 'unknown',
      label: ROUTE_GRADE_LABEL.unknown,
      tone: 'neutral',
      detail: 'Dados das vias indisponíveis agora — sem classificação por trecho.',
      criticalMeters: 0,
      attentionMeters: 0,
      reason: null,
    }
  }

  const base = { criticalMeters, attentionMeters, reason }
  const criticalShare = totalMeters > 0 ? criticalMeters / totalMeters : 0
  const attentionShare = totalMeters > 0 ? attentionMeters / totalMeters : 0

  // Trecho PROIBIDO para o veículo é categórico: não é uma questão de quantos
  // metros, é uma via em que ele não pode estar.
  if (eligibility === 'not-allowed') {
    return {
      ...base,
      grade: 'unsuitable',
      label: ROUTE_GRADE_LABEL.unsuitable,
      tone: 'critical',
      detail: reason
        ? `Inclui trecho incompatível: ${shortReason(REASON_TEXT[reason])}.`
        : 'Inclui trecho incompatível com o veículo.',
    }
  }

  if (criticalMeters >= SEVERE_CRITICAL_METERS || criticalShare >= SEVERE_CRITICAL_SHARE) {
    return {
      ...base,
      grade: 'unsuitable',
      label: ROUTE_GRADE_LABEL.unsuitable,
      tone: 'critical',
      detail: `${formatMeters(criticalMeters)} em via não recomendada${reason ? ` — ${shortReason(REASON_TEXT[reason])}` : ''}.`,
    }
  }

  if (criticalMeters > 0) {
    return {
      ...base,
      grade: 'poor',
      label: ROUTE_GRADE_LABEL.poor,
      tone: 'critical',
      detail: `${formatMeters(criticalMeters)} em via não recomendada${reason ? ` — ${shortReason(REASON_TEXT[reason])}` : ''}.`,
    }
  }

  if (attentionShare >= ATTENTION_SHARE) {
    return {
      ...base,
      grade: 'attention',
      label: ROUTE_GRADE_LABEL.attention,
      tone: 'attention',
      detail: `${formatMeters(attentionMeters)} do trajeto exigem atenção${reason ? ` — ${shortReason(REASON_TEXT[reason])}` : ''}.`,
    }
  }

  if (attentionMeters > 0 && attentionShare >= NEGLIGIBLE_ATTENTION_SHARE) {
    return {
      ...base,
      grade: 'good',
      label: ROUTE_GRADE_LABEL.good,
      tone: 'good',
      detail: `Quase todo o trajeto em vias adequadas, com ${formatMeters(attentionMeters)} de atenção.`,
    }
  }

  if (attentionMeters > 0) {
    return {
      ...base,
      grade: 'excellent',
      label: ROUTE_GRADE_LABEL.excellent,
      tone: 'good',
      detail: `Trajeto adequado ao veículo, com apenas ${formatMeters(attentionMeters)} de atenção.`,
    }
  }

  return {
    ...base,
    grade: 'excellent',
    label: ROUTE_GRADE_LABEL.excellent,
    tone: 'good',
    detail: 'Todo o trajeto em vias adequadas para o veículo.',
  }
}

function formatMeters(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`
  return `${(meters / 1000).toFixed(1)} km`
}

/**
 * O motivo, encurtado para caber DEPOIS de um travessão nosso.
 *
 * Vários textos de `REASON_TEXT` já são frases com travessão próprio ("Via
 * expressa ou rodovia — inadequada para este veículo"). Embutidos inteiros,
 * produziam "600 m em via não recomendada — via expressa ou rodovia —
 * inadequada para este veículo": dois travessões na mesma frase, com a segunda
 * metade repetindo o que a primeira já disse.
 *
 * Cortar no travessão preserva a parte que identifica a via, que é a única que
 * acrescenta algo neste contexto — "não recomendada" já foi dito.
 */
function shortReason(text: string): string {
  const cut = text.split(' — ')[0]
  return lowerFirst(cut)
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1)
}
