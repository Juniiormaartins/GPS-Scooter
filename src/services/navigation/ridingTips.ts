import { normalizeWayKind } from '@/services/routing/roadClassification'
import { needsLights } from '@/utils/sun'
import type { RainOutlook } from '@/services/weather/rain'
import type { CandidateRoute, WayKind } from '@/types/routing'

/**
 * DICAS DE CONDUÇÃO durante o trajeto.
 *
 * A DIFERENÇA PARA O ALERTA DE TRECHO. O alerta diz "ali tem um trecho ruim".
 * A dica diz "e é assim que se anda ali": onde ficar na pista e como ser visto
 * e previsível por quem vem atrás. O tom é de quem dá uma dica a um colega — o
 * usuário está no seu direito e na faixa certa, e nenhuma frase compara a
 * velocidade dele com a dos outros.
 *
 * REGRA DE OURO: só se fala o que o app SABE. Cada dica nasce de um dado
 * concreto da rota — a via é de fato arterial, há mesmo uma rotatória à
 * frente, já escureceu de verdade no lugar onde o usuário está. Nenhuma dica
 * é "lembrete geral" sorteado de uma lista: isso seria exatamente o aviso
 * genérico que se aprende a ignorar na segunda viagem.
 *
 * A VOZ. As frases levam o que é específico da situação — o nome da via, a
 * extensão do trecho, a velocidade DO USUÁRIO — e cada situação tem várias
 * redações, escolhidas de forma estável. Não é IA: é texto escrito para soar
 * como alguém que está vendo a mesma rua, e que não repete a mesma frase na
 * viagem seguinte.
 *
 * E É UM MÓDULO PURO, como `segmentAlerts`: decide, não executa. Quem fala e
 * quem lembra o que já foi dito é o hook.
 */

export interface RidingTip {
  /** Identidade estável — base de "cada dica uma vez por trajeto". */
  key: string
  kind: TipKind
  /** A frase inteira: é o que a VOZ fala e o que a tela mostra ao expandir. */
  text: string
  /**
   * O essencial em uma linha, para a tela. O motorista consome a dica pela voz;
   * a tela só confirma. Uma frase de quatro linhas sobre o mapa, em movimento,
   * cobria quase metade da tela e disputava com o que importa de verdade: ver o
   * caminho.
   */
  headline: string
}

export type TipKind = 'left-turn-busy' | 'roundabout' | 'busy-road' | 'night' | 'rain'

/** Intervalo mínimo entre duas dicas: dica em excesso vira ruído de fundo. */
const MIN_TIP_GAP_MS = 120_000
/** Respiro depois de um alerta de trecho — os dois não competem pela mesma atenção. */
const MIN_AFTER_ALERT_MS = 25_000
/** No começo da navegação o usuário ainda está se acomodando e ouvindo a primeira instrução. */
const MIN_AFTER_START_MS = 12_000
/** Teto por trajeto. Acima disso a dica vira conversa que ninguém pediu. */
const MAX_TIPS_PER_TRIP = 5

/** Acima disto o veículo não se comporta mais como autopropelido: a orientação de "ficar à direita" deixa de valer. */
const MAX_SPEED_FOR_BUSY_TIP_KMH = 45

/** Distância mínima até a próxima manobra: com manobra em cima, a voz é dela. */
const MIN_CLEAR_BEFORE_MANEUVER_METERS = 120

const BUSY_KINDS: WayKind[] = ['primary', 'secondary', 'trunk']

interface BusyRun {
  startMeters: number
  lengthMeters: number
  roadName?: string
}

export interface TipContext {
  route: CandidateRoute
  distanceTraveledMeters: number
  distanceToNextManeuverMeters: number
  referenceSpeedKmh: number
  position: { lat: number; lng: number } | null
  now: number
  tripStartedAt: number
  lastTipAt: number | null
  lastAlertAt: number | null
  announced: Set<string>
  /** Previsão de chuva no ponto do usuário; `null` = sem dado (e então não há dica). */
  rain?: RainOutlook | null
}

function segmentKind(segment: CandidateRoute['segments'][number]): WayKind {
  return segment.wayKind ?? normalizeWayKind(segment.roadClass)
}

/**
 * Trechos contínuos de via movimentada.
 *
 * "Movimentada" aqui é o tipo da via (primária/secundária/tronco), que é o que
 * o OSM sabe dizer — não é contagem de carros, e as frases não afirmam isso.
 * Sem classificação (rota ainda não enriquecida) não há trecho nenhum: dica
 * sobre via que o app não conhece seria invenção.
 */
export function findBusyRuns(route: CandidateRoute): BusyRun[] {
  const runs: BusyRun[] = []
  let offset = 0
  let current: { start: number; length: number; byName: Map<string, number> } | null = null

  const close = () => {
    if (!current) return
    let roadName: string | undefined
    let best = 0
    for (const [name, meters] of current.byName) {
      if (meters > best) {
        best = meters
        roadName = name
      }
    }
    runs.push({ startMeters: current.start, lengthMeters: current.length, roadName })
    current = null
  }

  for (const segment of route.segments) {
    if (BUSY_KINDS.includes(segmentKind(segment))) {
      if (!current) current = { start: offset, length: 0, byName: new Map() }
      current.length += segment.distanceMeters
      if (segment.roadName) {
        current.byName.set(segment.roadName, (current.byName.get(segment.roadName) ?? 0) + segment.distanceMeters)
      }
    } else {
      close()
    }
    offset += segment.distanceMeters
  }
  close()

  return runs
}

function isOnBusyRoad(runs: BusyRun[], meters: number): boolean {
  return runs.some((run) => meters >= run.startMeters && meters <= run.startMeters + run.lengthMeters)
}

/** Decide se há uma dica a dar AGORA. Pura: não fala, não guarda estado, não lê o relógio. */
export function nextRidingTip(context: TipContext): RidingTip | null {
  const { route, distanceTraveledMeters, now, announced } = context

  if (announced.size >= MAX_TIPS_PER_TRIP) return null
  if (now - context.tripStartedAt < MIN_AFTER_START_MS) return null
  if (context.lastTipAt != null && now - context.lastTipAt < MIN_TIP_GAP_MS) return null
  if (context.lastAlertAt != null && now - context.lastAlertAt < MIN_AFTER_ALERT_MS) return null

  const busy = findBusyRuns(route)
  const candidates: { priority: number; tip: RidingTip }[] = []

  // --- Curva à esquerda em via movimentada -------------------------------
  // É onde o veículo lento mais sofre: cruzar o fluxo inteiro para chegar do
  // outro lado. Só vale quando a via de ONDE se sai é realmente movimentada.
  for (const step of route.steps) {
    if (step.maneuver !== 'turn-left') continue
    const ahead = step.cumulativeDistanceMeters - distanceTraveledMeters
    if (ahead < 70 || ahead > 220) continue
    if (!isOnBusyRoad(busy, step.cumulativeDistanceMeters - 5)) continue

    const key = `tip:left:${Math.round(step.cumulativeDistanceMeters)}`
    if (announced.has(key)) continue
    candidates.push({ priority: 0, tip: { key, kind: 'left-turn-busy', text: leftTurnText(key, announced.size), headline: 'Curva à esquerda: espere o espaço' } })
  }

  // --- Rotatória ---------------------------------------------------------
  for (const step of route.steps) {
    if (step.maneuver !== 'roundabout') continue
    const ahead = step.cumulativeDistanceMeters - distanceTraveledMeters
    if (ahead < 60 || ahead > 200) continue

    const key = `tip:round:${Math.round(step.cumulativeDistanceMeters)}`
    if (announced.has(key)) continue
    candidates.push({ priority: 1, tip: { key, kind: 'roundabout', text: roundaboutText(key, announced.size), headline: 'Rotatória: reduza e sinalize' } })
  }

  // --- Via movimentada: a dica de "onde ficar" ---------------------------
  if (
    context.referenceSpeedKmh <= MAX_SPEED_FOR_BUSY_TIP_KMH &&
    context.distanceToNextManeuverMeters >= MIN_CLEAR_BEFORE_MANEUVER_METERS
  ) {
    for (const run of busy) {
      // Já começou nela (saída de casa, retomada de trajeto) também conta,
      // desde que ainda reste o que dizer: pouca coisa a percorrer não vale a fala.
      const ahead = run.startMeters - distanceTraveledMeters
      const remaining = run.startMeters + run.lengthMeters - distanceTraveledMeters
      const entering = ahead >= 40 && ahead <= 260
      const inside = ahead < 40 && remaining >= 300 && distanceTraveledMeters - run.startMeters <= 150
      if (!entering && !inside) continue
      if (run.lengthMeters < 400) continue

      const key = `tip:busy:${Math.round(run.startMeters)}`
      if (announced.has(key)) continue
      candidates.push({
        priority: 2,
        tip: {
          key,
          kind: 'busy-road',
          headline: inside ? 'Via movimentada: siga à direita' : 'Via movimentada: vá à direita',
          // Ao ENTRAR, fala-se o tamanho do trecho; já DENTRO dele, o que resta.
          // Usar `remaining` nos dois casos somava os metros que ainda faltam
          // para chegar à via ao comprimento da via ("1,4 km" para 1,2).
          text: busyRoadText(key, announced.size, run, entering ? run.lengthMeters : Math.max(remaining, 0), inside),
        },
      })
    }
  }

  // --- Chuva -------------------------------------------------------------
  // Vem ANTES da via movimentada: piso molhado muda o que qualquer outra dica
  // pede. Uma vez por trajeto, e só com previsão de verdade — sem dado, calado.
  const rain = context.rain
  if (rain && !announced.has('tip:rain') && (rain.raining || (rain.minutesUntilRain != null && rain.minutesUntilRain <= 30))) {
    candidates.push({
      priority: 1.5,
      tip: {
        key: 'tip:rain',
        kind: 'rain',
        text: rainText(announced.size, rain),
        headline: rain.raining ? 'Chuva: freie mais cedo' : `Chuva em ~${rain.minutesUntilRain} min: mais folga`,
      },
    })
  }

  // --- Noite -------------------------------------------------------------
  if (context.position && !announced.has('tip:night') && needsLights(new Date(now), context.position.lat, context.position.lng)) {
    candidates.push({ priority: 3, tip: { key: 'tip:night', kind: 'night', text: nightText(announced.size), headline: 'Anoiteceu: confira as luzes' } })
  }

  if (candidates.length === 0) return null
  candidates.sort((a, b) => a.priority - b.priority)
  return candidates[0].tip
}

// ───────────────────────────── As frases ─────────────────────────────
//
// Várias redações por situação, escolhidas pela CHAVE da dica: a mesma
// avenida sempre sai com a mesma frase (previsível, testável), avenidas
// diferentes saem com frases diferentes. O contador de dicas já dadas entra
// na conta para que duas seguidas não caiam na mesma redação por azar.

function pick<T>(options: T[], key: string, given: number): T {
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  return options[(hash + given) % options.length]
}

/** "a Avenida 85", "o Anel Viário" — nome de rua lido sem artigo soa telegrama. */
function withArticle(roadName: string | undefined): string | null {
  if (!roadName) return null
  const feminine = /^(avenida|av\.|rua|rodovia|alameda|travessa|praça|estrada|marginal|via|br-?\d|go-?\d)/i
  const masculine = /^(anel|viaduto|trevo|setor|parque|jardim|largo)/i
  if (feminine.test(roadName)) return `a ${roadName}`
  if (masculine.test(roadName)) return `o ${roadName}`
  return roadName
}

/** Extensão falada do jeito que se fala: arredondada, nunca "637 metros". */
function spokenLength(meters: number): string {
  if (meters >= 950) {
    const km = Math.round(meters / 100) / 10
    return km === 1 ? 'um quilômetro' : `${String(km).replace('.', ',')} quilômetros`
  }
  return `${Math.max(100, Math.round(meters / 100) * 100)} metros`
}

function busyRoadText(
  key: string,
  given: number,
  run: BusyRun,
  remainingMeters: number,
  alreadyOn: boolean,
): string {
  const via = withArticle(run.roadName)
  const len = spokenLength(remainingMeters)

  /*
    O TOM, que já foi errado uma vez. A primeira versão dizia que o trânsito
    "anda bem mais rápido que os seus 32 por hora" e pedia para "deixar os
    carros passarem" — o que soa como pedir desculpa por existir. Quem anda de
    autopropelido está no seu direito e na faixa certa; o conselho útil é sobre
    SER VISTO e PREVISÍVEL, não sobre ser lento. Nenhuma frase aqui compara a
    velocidade do usuário com a dos outros.
  */

  // Já em cima da via: "vem aí" seria mentira. Frases próprias para esse caso.
  if (alreadyOn) {
    // "a Rua 82" -> "na Rua 82": preposição contraída com o artigo.
    const em = via ? via.replace(/^(a|o) /, (m) => (m === 'a ' ? 'na ' : 'no ')) : null
    const here = via
      ? [
          `Você está ${em}, ainda uns ${len}. Mantém a direita e a trajetória firme: assim quem vem atrás te vê e passa com folga.`,
          `Seguem uns ${len} ${em}. Fica à direita, sem ziguezaguear, e olha para trás antes de qualquer desvio.`,
        ]
      : [
          `Ainda uns ${len} de via movimentada. Mantém a direita e a trajetória firme: assim quem vem atrás te vê e passa com folga.`,
          `Mais uns ${len} de via movimentada. Fica à direita, sem ziguezaguear, e olha para trás antes de qualquer desvio.`,
        ]
    return pick(here, key + (run.roadName ?? ''), given)
  }

  const withName = [
    `Daqui a pouco entra ${via}, uns ${len} movimentados. Vai pela direita, com a trajetória firme: assim quem vem atrás te vê e passa com folga.`,
    `${capitalize(via ?? '')} à frente, uns ${len}. Segue pela direita, sem ziguezaguear, e avisa com o braço antes de qualquer desvio.`,
    `Olha, ${via} vem aí, uns ${len}. Fica à direita, com a linha previsível, e olha para trás antes de mudar de lado.`,
  ]
  const withoutName = [
    `Vem um trecho movimentado, uns ${len}. Vai pela direita, com a trajetória firme: assim quem vem atrás te vê e passa com folga.`,
    `Via mais movimentada à frente, uns ${len}. Segue pela direita, sem ziguezaguear, e avisa com o braço antes de qualquer desvio.`,
    `Trecho movimentado chegando, uns ${len}. Fica à direita, com a linha previsível, e olha para trás antes de mudar de lado.`,
  ]
  // O nome entra no sorteio: duas vias na mesma posição de rotas diferentes
  // não devem cair, sempre, na mesma redação.
  return pick(via ? withName : withoutName, key + (run.roadName ?? ''), given)
}

function leftTurnText(key: string, given: number): string {
  return pick(
    [
      'Curva à esquerda numa via cheia. Sinaliza cedo e atravessa só quando o espaço abrir; se o fluxo estiver forte, vale esperar.',
      'Vai virar à esquerda numa via com movimento. Avisa com o braço e espera um espaço de verdade, sem parar no meio da pista.',
      'Conversão à esquerda numa via movimentada: sinaliza com antecedência e, se o fluxo não abrir, espera em vez de forçar a passagem.',
    ],
    key,
    given,
  )
}

function roundaboutText(key: string, given: number): string {
  return pick(
    [
      'Rotatória chegando. Reduz, entra quando tiver espaço e sinaliza a saída com o braço.',
      'Rotatória à frente: olha o fluxo que já está nela e deixa clara a sua saída.',
      'Rotatória logo à frente. Vai com calma e avisa a saída com antecedência.',
    ],
    key,
    given,
  )
}

function rainText(given: number, rain: RainOutlook): string {
  if (rain.raining) {
    return pick(
      [
        'A previsão indica chuva por aí. Molhado, a roda pequena escorrega mais: freia mais cedo, com suavidade, e cuidado com faixa pintada e tampa de bueiro.',
        'Chuva na região, segundo a previsão. Dobra a distância de frenagem e passa devagar por faixa de pedestre e bueiro.',
        'Parece chover por aí. Acelera e freia com suavidade, e desvia de poça: ela esconde buraco.',
      ],
      'tip:rain',
      given,
    )
  }
  const min = rain.minutesUntilRain ?? 15
  return pick(
    [
      `A previsão indica chuva daqui a uns ${min} minutos. Piso molhado pede mais distância para frear: se der, chega antes; senão, já vai com mais folga.`,
      `Pode chover daqui a uns ${min} minutos, pela previsão. Molhado, a frenagem alonga: deixa mais folga.`,
    ],
    'tip:rain',
    given,
  )
}

function nightText(given: number): string {
  return pick(
    [
      'Já escureceu. Confere farol e lanterna traseira: quem vem atrás precisa te ver de longe.',
      'Anoiteceu. Vale checar as luzes da frente e de trás: é o que faz o motorista te enxergar a tempo.',
    ],
    'tip:night',
    given,
  )
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
