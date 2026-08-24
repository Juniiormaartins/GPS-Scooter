import type { LngLat } from '@/config/region'
import { haversineDistanceMeters } from '@/utils/geo'
import type { CandidateRoute } from '@/types/routing'

/**
 * Elevação e inclinação dos trechos da rota.
 *
 * INVESTIGAÇÃO (o pedido era explícito: nada de dado falso ou inferido do
 * nome da rua). O que foi testado, de verdade, antes de escolher:
 *
 * - Valhalla `/height`: o servidor demo da FOSSGIS expõe esse endpoint, mas
 *   o host inteiro é inalcançável do ambiente onde este código foi escrito
 *   (até `/status` falha). Não deu para verificar empiricamente, e o servidor
 *   demo pede uso comedido — descartado como fonte primária.
 * - OpenTopoData (api.opentopodata.org): responde com elevação correta, mas
 *   NÃO envia `Access-Control-Allow-Origin`. Inutilizável direto do
 *   navegador, que é onde este app roda. Descartado.
 * - Open-Meteo Elevation (api.open-meteo.com/v1/elevation): responde 200,
 *   aceita 100 coordenadas por chamada, não exige chave e envia
 *   `access-control-allow-origin: *`. Testado em Goiânia: 774 m e 803 m em
 *   dois pontos, batendo com os 771 m / 800 m que o OpenTopoData devolveu
 *   para as mesmas coordenadas. É a fonte usada aqui.
 *
 * LIMITAÇÃO QUE IMPORTA E NÃO DÁ PARA CONTORNAR: o modelo de elevação por
 * trás é um DEM de ~90 m de resolução. Ele descreve o RELEVO (o morro, a
 * descida do vale), não o perfil fino do asfalto. Por isso:
 * - a inclinação é calculada sobre trechos agregados de pelo menos
 *   `MIN_GRADE_SAMPLE_METERS`, nunca entre dois pontos colados;
 * - o resultado é tratado como ESTIMATIVA e a UI diz isso;
 * - rampas curtas (uma quadra íngreme, um viaduto) podem passar despercebidas.
 * Detectar isso exigiria levantamento de campo ou DEM de 1 m (LiDAR), que não
 * existe publicamente para Goiânia.
 */

const ELEVATION_BASE_URL = 'https://api.open-meteo.com/v1/elevation'

/** Limite por requisição, conforme a API. */
const MAX_POINTS_PER_REQUEST = 100

/**
 * Distância mínima sobre a qual uma inclinação é calculada. Abaixo disso o
 * ruído do DEM domina: 3 m de erro de altitude em 20 m de distância viraria
 * uma "subida de 15%" inexistente.
 *
 * O valor não foi chutado. Numa rota real de 6,32 km em Goiânia (774 m → 830 m,
 * 130 m de subida acumulada), a mesma amostragem deste arquivo foi recalculada
 * com janelas diferentes e o ruído aparece de forma inequívoca na proporção de
 * trechos classificados como íngremes (≥6%):
 *
 *    janela  ~64 m → pico +12,5% / −14,1% → 23% da rota "íngreme"
 *    janela ~120 m → pico  +8,6% /  −9,4% →  9% da rota
 *    janela ~200 m → pico  +6,8% /  −6,8% →  6% da rota
 *    janela ~300 m → pico  +5,6% /  −6,6% →  3% da rota
 *
 * 23% de uma rota urbana em rampa forte é implausível — é o DEM tremendo. A
 * curva estabiliza a partir de ~200 m, que é onde os picos param de encolher
 * abruptamente e passam a descrever relevo de verdade. Daí o valor abaixo.
 */
const MIN_GRADE_SAMPLE_METERS = 200

const ELEVATION_TIMEOUT_MS = 6000

export type GradeClass = 'flat' | 'gentle-climb' | 'steep-climb' | 'gentle-descent' | 'steep-descent'

/**
 * Limiares em porcentagem. 6% é onde uma scooter/patinete elétrico começa
 * claramente a perder velocidade e autonomia na subida; na descida é onde a
 * frenagem passa a exigir atenção real. Abaixo de 3% é plano na prática.
 */
const STEEP_GRADE_PERCENT = 6
const GENTLE_GRADE_PERCENT = 3

export interface RouteElevationProfile {
  /** Inclinação estimada por segmento da rota, no mesmo índice de `route.segments`. */
  gradeBySegment: (number | null)[]
  totalAscentMeters: number
  totalDescentMeters: number
}

export function classifyGrade(gradePercent: number | null): GradeClass | null {
  if (gradePercent == null) return null
  if (gradePercent >= STEEP_GRADE_PERCENT) return 'steep-climb'
  if (gradePercent >= GENTLE_GRADE_PERCENT) return 'gentle-climb'
  if (gradePercent <= -STEEP_GRADE_PERCENT) return 'steep-descent'
  if (gradePercent <= -GENTLE_GRADE_PERCENT) return 'gentle-descent'
  return 'flat'
}

export const GRADE_LABEL: Record<GradeClass, string> = {
  flat: 'plano',
  'gentle-climb': 'subida leve',
  'steep-climb': 'subida íngreme',
  'gentle-descent': 'descida leve',
  'steep-descent': 'descida íngreme',
}

/**
 * Busca a elevação da rota e devolve a inclinação estimada de cada segmento.
 *
 * Falha silenciosa e proposital: se a API não responder, devolve `null`. O
 * chamador segue sem perfil de elevação — a rota continua válida, só perde
 * essa dimensão da avaliação. Nunca chuta um valor no lugar.
 */
export async function fetchRouteElevationProfile(route: CandidateRoute): Promise<RouteElevationProfile | null> {
  // Amostra a geometria em pontos regularmente espaçados: o orçamento de 100
  // pontos por chamada é gasto onde ele rende, e não em 4 pontos colados numa
  // curva enquanto uma reta de 2 km fica sem amostra nenhuma.
  const samples = sampleAlongRoute(route.geometry, MAX_POINTS_PER_REQUEST)
  if (samples.length < 2) return null

  const elevations = await fetchElevations(samples.map((entry) => entry.point))
  if (!elevations) return null

  let totalAscentMeters = 0
  let totalDescentMeters = 0
  for (let i = 1; i < elevations.length; i += 1) {
    const delta = elevations[i] - elevations[i - 1]
    if (delta > 0) totalAscentMeters += delta
    else totalDescentMeters += -delta
  }

  const gradeBySegment = route.segments.map((_, index) => {
    const start = cumulativeDistanceBefore(route, index)
    const end = start + route.segments[index].distanceMeters
    return estimateGradePercent(samples, elevations, start, end)
  })

  return {
    gradeBySegment,
    totalAscentMeters: Math.round(totalAscentMeters),
    totalDescentMeters: Math.round(totalDescentMeters),
  }
}

function cumulativeDistanceBefore(route: CandidateRoute, segmentIndex: number): number {
  let total = 0
  for (let i = 0; i < segmentIndex; i += 1) total += route.segments[i].distanceMeters
  return total
}

/**
 * Inclinação média do trecho [startMeters, endMeters] da rota.
 *
 * Se o segmento for mais curto que `MIN_GRADE_SAMPLE_METERS`, a janela é
 * EXPANDIDA simetricamente até esse mínimo, em vez de devolver um número
 * baseado em ruído. O valor então descreve honestamente "a inclinação do
 * trecho de rua onde este segmento está".
 */
function estimateGradePercent(
  samples: { point: LngLat; distanceAlongMeters: number }[],
  elevations: number[],
  startMeters: number,
  endMeters: number,
): number | null {
  const span = endMeters - startMeters
  const padding = span >= MIN_GRADE_SAMPLE_METERS ? 0 : (MIN_GRADE_SAMPLE_METERS - span) / 2
  const from = Math.max(0, startMeters - padding)
  const to = endMeters + padding

  const startElevation = interpolateElevation(samples, elevations, from)
  const endElevation = interpolateElevation(samples, elevations, to)
  if (startElevation == null || endElevation == null) return null

  const horizontal = to - from
  if (horizontal < MIN_GRADE_SAMPLE_METERS / 2) return null

  return ((endElevation - startElevation) / horizontal) * 100
}

function interpolateElevation(
  samples: { distanceAlongMeters: number }[],
  elevations: number[],
  distanceAlongMeters: number,
): number | null {
  if (samples.length === 0) return null
  if (distanceAlongMeters <= samples[0].distanceAlongMeters) return elevations[0]

  for (let i = 1; i < samples.length; i += 1) {
    if (samples[i].distanceAlongMeters >= distanceAlongMeters) {
      const previous = samples[i - 1]
      const current = samples[i]
      const span = current.distanceAlongMeters - previous.distanceAlongMeters
      if (span <= 0) return elevations[i]
      const ratio = (distanceAlongMeters - previous.distanceAlongMeters) / span
      return elevations[i - 1] + ratio * (elevations[i] - elevations[i - 1])
    }
  }

  return elevations[elevations.length - 1]
}

/** Pontos igualmente espaçados ao longo da geometria, com a distância acumulada de cada um. */
function sampleAlongRoute(geometry: LngLat[], count: number): { point: LngLat; distanceAlongMeters: number }[] {
  if (geometry.length === 0) return []
  if (geometry.length === 1) return [{ point: geometry[0], distanceAlongMeters: 0 }]

  const cumulative: number[] = [0]
  for (let i = 1; i < geometry.length; i += 1) {
    cumulative.push(cumulative[i - 1] + haversineDistanceMeters(geometry[i - 1], geometry[i]))
  }
  const total = cumulative[cumulative.length - 1]
  if (total <= 0) return [{ point: geometry[0], distanceAlongMeters: 0 }]

  const result: { point: LngLat; distanceAlongMeters: number }[] = []
  let cursor = 0
  for (let i = 0; i < count; i += 1) {
    const target = (total * i) / (count - 1)
    while (cursor < cumulative.length - 2 && cumulative[cursor + 1] < target) cursor += 1

    const span = cumulative[cursor + 1] - cumulative[cursor]
    const ratio = span > 0 ? (target - cumulative[cursor]) / span : 0
    const a = geometry[cursor]
    const b = geometry[cursor + 1]
    result.push({
      point: { lng: a.lng + (b.lng - a.lng) * ratio, lat: a.lat + (b.lat - a.lat) * ratio },
      distanceAlongMeters: target,
    })
  }

  return result
}

async function fetchElevations(points: LngLat[]): Promise<number[] | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ELEVATION_TIMEOUT_MS)

  try {
    const latitudes = points.map((point) => point.lat.toFixed(5)).join(',')
    const longitudes = points.map((point) => point.lng.toFixed(5)).join(',')
    const response = await fetch(`${ELEVATION_BASE_URL}?latitude=${latitudes}&longitude=${longitudes}`, {
      signal: controller.signal,
    })
    if (!response.ok) return null

    const payload = (await response.json()) as { elevation?: unknown }
    if (!Array.isArray(payload.elevation)) return null

    const elevations = payload.elevation
    if (elevations.length !== points.length) return null
    if (!elevations.every((value) => typeof value === 'number' && Number.isFinite(value))) return null

    return elevations as number[]
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
