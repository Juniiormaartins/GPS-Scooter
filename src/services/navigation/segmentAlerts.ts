import { REASON_TEXT, type SuitabilityReasonCode } from '@/config/mobilityProfiles'
import type { RouteSeverityAnalysis, SeverityRun } from '@/services/routing/segmentSeverity'
import type { CandidateRoute } from '@/types/routing'

/**
 * ALERTA ANTECIPADO DE TRECHO CRÍTICO.
 *
 * O app já sabe, desde o cálculo da rota, exatamente onde estão os trechos
 * ruins — está tudo em `severity.runs`. O que faltava era dizer isso ANTES,
 * enquanto ainda dá para decidir alguma coisa. Chegar num acostamento de
 * rodovia e só então ver a linha ficar vermelha na tela é informação que
 * chegou tarde.
 *
 * O PROBLEMA DE VERDADE AQUI NÃO É DETECTAR — é calar a boca. Um trajeto
 * urbano tem dezenas de travessias e acessos curtos; avisar de todos
 * transformaria a navegação num alarme contínuo, e um alarme contínuo é
 * exatamente equivalente a nenhum alarme, porque o usuário para de ouvir. Por
 * isso este módulo é, em maior parte, um conjunto de regras de silêncio:
 *
 *   - cada trecho avisa UMA vez (`announcedRunKeys`);
 *   - trechos curtos demais não avisam nada (`MIN_ANNOUNCE_METERS`);
 *   - dois avisos nunca saem colados (`MIN_GAP_MS`);
 *   - o aviso tem janela: nem cedo demais para ser esquecido, nem em cima.
 */

export type AlertLevel =
  /** Exposição curta — travessia, acesso, retorno. */
  | 'attention'
  /** Percurso em via não recomendada para o veículo. */
  | 'critical'
  /** Via em que o veículo não pode estar: escada, acesso restrito. */
  | 'incompatible'

export interface SegmentAlert {
  /** Identidade estável do trecho dentro da rota — base da regra "avisa uma vez". */
  key: string
  level: AlertLevel
  distanceAheadMeters: number
  runDistanceMeters: number
  reason: SuitabilityReasonCode
  roadName?: string
  /** Texto para a tela. */
  text: string
  /** Texto para a voz — mais curto e sem pontuação que atrapalhe a síntese. */
  speech: string
}

/**
 * Distância do aviso, por nível.
 *
 * Escalonada porque o que o usuário FAZ com o aviso é diferente em cada caso.
 * Num trecho de atenção ele só precisa reduzir e se posicionar: 200 m bastam.
 * Num trecho não recomendado a decisão possível é maior — encostar, reavaliar,
 * pegar outra rua —, e a 25 km/h 450 m são pouco mais de um minuto para
 * decidir. Avisar cedo demais também falha: aviso de 2 km é esquecido antes de
 * chegar.
 */
const LEAD_METERS: Record<AlertLevel, number> = {
  attention: 200,
  critical: 450,
  incompatible: 450,
}

/**
 * Abaixo desta distância o aviso já não serve — o trecho começa praticamente
 * agora, e falar em cima só assusta.
 */
const MIN_LEAD_METERS = 40

/**
 * Trecho curto demais para merecer voz.
 *
 * 80 m a 25 km/h são doze segundos. Anunciar isso é ruído: quando a frase
 * terminar, o trecho já passou.
 */
const MIN_ANNOUNCE_METERS = 80

/** Intervalo mínimo entre dois avisos de trecho, para não empilhar com as manobras. */
const MIN_GAP_MS = 20000

/** Metros de cada trecho a partir do início da rota. */
export function runStartOffsets(route: CandidateRoute, runs: SeverityRun[]): number[] {
  const cumulative: number[] = []
  let total = 0
  for (const segment of route.segments) {
    cumulative.push(total)
    total += segment.distanceMeters
  }
  return runs.map((run) => cumulative[run.segmentIndexes[0]] ?? 0)
}

function levelFor(run: SeverityRun): AlertLevel {
  // Motivo manda sobre comprimento: uma escada de 30 m não é "atenção
  // moderada" por ser curta — é um lugar onde o veículo não passa.
  if (run.reason === 'not-rideable' || run.reason === 'access-restricted') return 'incompatible'
  return run.severity === 'critical' ? 'critical' : 'attention'
}

export interface AlertContext {
  route: CandidateRoute
  severity: RouteSeverityAnalysis
  distanceTraveledMeters: number
  announcedRunKeys: Set<string>
  lastAlertAt: number | null
  now?: number
}

/**
 * Decide se algo deve ser anunciado AGORA. Função pura: não fala, não guarda
 * estado, não olha o relógio por conta própria. Quem chama é que aplica o
 * efeito e registra o que foi dito — é o que a torna testável sem navegação.
 */
export function nextSegmentAlert(context: AlertContext): SegmentAlert | null {
  const { route, severity, distanceTraveledMeters, announcedRunKeys, lastAlertAt } = context
  const now = context.now ?? Date.now()

  // Sem classificação confiável não há o que anunciar. Avisar sobre trechos
  // que saíram como adequados por FALTA de dado seria inventar perigo.
  if (!severity.isReliable || severity.runs.length === 0) return null
  if (lastAlertAt != null && now - lastAlertAt < MIN_GAP_MS) return null

  const offsets = runStartOffsets(route, severity.runs)

  const candidates: SegmentAlert[] = []
  severity.runs.forEach((run, index) => {
    if (run.distanceMeters < MIN_ANNOUNCE_METERS) return

    const key = `${run.segmentIndexes[0]}-${run.segmentIndexes[run.segmentIndexes.length - 1]}`
    if (announcedRunKeys.has(key)) return

    const distanceAheadMeters = offsets[index] - distanceTraveledMeters
    const level = levelFor(run)
    if (distanceAheadMeters < MIN_LEAD_METERS || distanceAheadMeters > LEAD_METERS[level]) return

    candidates.push({
      key,
      level,
      distanceAheadMeters,
      runDistanceMeters: run.distanceMeters,
      reason: run.reason,
      roadName: run.roadName,
      ...describe(level, distanceAheadMeters, run),
    })
  })

  if (candidates.length === 0) return null

  // Gravidade primeiro, proximidade depois: com dois trechos na janela, o que
  // importa dizer é o pior, não o mais perto.
  const order: Record<AlertLevel, number> = { incompatible: 0, critical: 1, attention: 2 }
  candidates.sort((a, b) => order[a.level] - order[b.level] || a.distanceAheadMeters - b.distanceAheadMeters)
  return candidates[0]
}

/**
 * As frases.
 *
 * A distância é ARREDONDADA para a dezena/centena mais próxima. "Em 437 metros"
 * é falsa precisão sobre uma projeção de GPS e ainda soa péssimo na síntese de
 * voz; "em 450 metros" diz a mesma coisa e é o que uma pessoa falaria.
 *
 * O texto da tela nomeia a via quando ela é conhecida — é o que permite
 * reconhecer o lugar antes de chegar. A voz não a repete: nome de rua lido pela
 * síntese em meio a uma frase longa atrapalha mais do que ajuda, e o nome já
 * está na tela.
 */
function describe(level: AlertLevel, aheadMeters: number, run: SeverityRun): { text: string; speech: string } {
  const distancia = roundDistance(aheadMeters)
  // "Em 450 metros em BR-153" tem dois "em" seguidos com funções diferentes e
  // trava a leitura. A vírgula separa a distância do lugar, que é como se fala.
  const via = run.roadName ? `, na ${run.roadName},` : ''
  const motivo = REASON_TEXT[run.reason]

  if (level === 'incompatible') {
    return {
      text: `Em ${distancia}${via} há um trecho incompatível com seu veículo — ${lowerFirst(motivo)}.`,
      speech: `Em ${distancia}, trecho incompatível com seu veículo.`,
    }
  }

  if (level === 'critical') {
    return {
      text: `Em ${distancia}${via} começa um trecho não recomendado — ${lowerFirst(motivo)}.`,
      speech: `Em ${distancia}, começa um trecho não recomendado para seu veículo.`,
    }
  }

  return {
    text: `Em ${distancia}${via} há um trecho curto que exige atenção — ${lowerFirst(motivo)}.`,
    speech: `Em ${distancia}, trecho que exige atenção.`,
  }
}

function roundDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} quilômetros`
  const step = meters >= 200 ? 50 : 10
  return `${Math.round(meters / step) * step} metros`
}

/** Ver a mesma decisão em routeGrade: `REASON_TEXT` já traz travessão próprio. */
function lowerFirst(text: string): string {
  const cut = text.split(' — ')[0]
  return cut.charAt(0).toLowerCase() + cut.slice(1)
}
