import { haversineDistanceMeters } from '@/utils/geo'
import type { ActivityEntry } from '@/services/storage/activityHistory'
import type { LngLat } from '@/config/region'

/**
 * PADRÕES DE USO — o que o histórico já sabe e nunca disse.
 *
 * O app grava cada rota calculada desde sempre (activityHistory), e essa lista
 * vinha sendo mostrada como o que ela é: uma pilha cronológica. Uma pilha
 * responde "o que fiz ontem". O que o usuário quer da tela de atividade é
 * "leva-me de novo aonde eu sempre vou", e essa resposta já está no mesmo dado
 * — só não estava sendo lida.
 *
 * TUDO É LOCAL E DERIVADO. Nada aqui é gravado: os padrões são recalculados a
 * partir do histórico a cada leitura. Não existe perfil de usuário armazenado,
 * não há envio para lugar nenhum, e apagar o histórico apaga os padrões junto —
 * é a mesma tecla. Foi o critério para decidir o que entrava: qualquer coisa
 * que exigisse guardar um dado NOVO sobre o comportamento do usuário ficou de
 * fora.
 */

/**
 * Raio para considerar dois registros "o mesmo lugar".
 *
 * 120 m e não 40 m (o valor da deduplicação de busca) porque aqui a pergunta é
 * outra. Lá era "estes dois resultados são o mesmo estabelecimento?"; aqui é
 * "o usuário foi para o mesmo lugar?", e o ponto de destino varia: um dia a
 * rota termina na entrada da rua, outro dia no estacionamento dos fundos. 120 m
 * é a ordem de grandeza de um quarteirão — perto o bastante para ser o mesmo
 * destino, longe o bastante para não fundir dois comércios vizinhos.
 */
const SAME_PLACE_METERS = 120

/** Abaixo disto não é padrão, é coincidência. */
const MIN_VISITS_FOR_FREQUENT = 3
/** Um trajeto repetido exige menos porque ele casa origem E destino — é um sinal mais forte. */
const MIN_TRIPS_FOR_ROUTINE = 2

export interface FrequentPlace {
  label: string
  point: LngLat
  visits: number
  lastVisitAt: number
  /** Faixa de horário em que as visitas se concentram, quando há concentração. */
  timeBand: TimeBand | null
}

export interface RoutineTrip {
  originLabel: string
  destinationLabel: string
  originPoint: LngLat
  destinationPoint: LngLat
  trips: number
  lastAt: number
  /** Mediana da distância — os registros variam alguns metros entre si. */
  distanceMeters: number
}

/**
 * Faixas de horário, não horas exatas.
 *
 * "Você costuma ir às 8h" é falso para quem sai entre 7h30 e 8h45, que é como
 * as pessoas realmente se comportam. A faixa é verdadeira para o mesmo dado.
 */
export type TimeBand = 'manha' | 'tarde' | 'noite'

export const TIME_BAND_LABEL: Record<TimeBand, string> = {
  manha: 'de manhã',
  tarde: 'à tarde',
  noite: 'à noite',
}

function bandFor(timestamp: number): TimeBand {
  const hour = new Date(timestamp).getHours()
  if (hour < 12) return 'manha'
  if (hour < 18) return 'tarde'
  return 'noite'
}

/**
 * Fração das visitas que precisa cair na mesma faixa para o horário virar
 * padrão. Abaixo disso o horário não descreve nada e a frase some — melhor
 * dizer só "você costuma ir aqui" do que inventar uma rotina.
 */
const TIME_BAND_DOMINANCE = 0.6

/** Agrupa registros por proximidade do destino. */
function clusterByDestination(entries: ActivityEntry[]): ActivityEntry[][] {
  const clusters: ActivityEntry[][] = []

  for (const entry of entries) {
    if (!entry.destinationPoint) continue
    const found = clusters.find((cluster) => {
      const head = cluster[0].destinationPoint
      return head != null && haversineDistanceMeters(head, entry.destinationPoint!) < SAME_PLACE_METERS
    })
    if (found) found.push(entry)
    else clusters.push([entry])
  }

  return clusters
}

export function frequentPlaces(entries: ActivityEntry[]): FrequentPlace[] {
  return clusterByDestination(entries)
    .filter((cluster) => cluster.length >= MIN_VISITS_FOR_FREQUENT)
    .map((cluster) => {
      const counts = new Map<TimeBand, number>()
      for (const entry of cluster) {
        const band = bandFor(entry.timestamp)
        counts.set(band, (counts.get(band) ?? 0) + 1)
      }
      const [topBand, topCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0]

      /*
        O RÓTULO vem do registro MAIS RECENTE, não do primeiro.

        O mesmo lugar aparece com nomes diferentes ao longo do tempo — uma vez
        pelo nome do estabelecimento, outra pelo endereço, dependendo de qual
        resultado da busca o usuário tocou. O mais recente é o que ele reconhece
        agora.
      */
      const newest = [...cluster].sort((a, b) => b.timestamp - a.timestamp)[0]

      return {
        label: newest.destinationLabel,
        point: newest.destinationPoint!,
        visits: cluster.length,
        lastVisitAt: newest.timestamp,
        timeBand: topBand != null && topCount / cluster.length >= TIME_BAND_DOMINANCE ? topBand : null,
      }
    })
    .sort((a, b) => b.visits - a.visits || b.lastVisitAt - a.lastVisitAt)
}

export function routineTrips(entries: ActivityEntry[]): RoutineTrip[] {
  const withBoth = entries.filter((entry) => entry.originPoint && entry.destinationPoint)
  const clusters: ActivityEntry[][] = []

  for (const entry of withBoth) {
    const found = clusters.find((cluster) => {
      const head = cluster[0]
      return (
        haversineDistanceMeters(head.originPoint!, entry.originPoint!) < SAME_PLACE_METERS &&
        haversineDistanceMeters(head.destinationPoint!, entry.destinationPoint!) < SAME_PLACE_METERS
      )
    })
    if (found) found.push(entry)
    else clusters.push([entry])
  }

  return clusters
    .filter((cluster) => cluster.length >= MIN_TRIPS_FOR_ROUTINE)
    .map((cluster) => {
      const newest = [...cluster].sort((a, b) => b.timestamp - a.timestamp)[0]
      const distances = cluster.map((entry) => entry.distanceMeters).sort((a, b) => a - b)
      return {
        originLabel: newest.originLabel,
        destinationLabel: newest.destinationLabel,
        originPoint: newest.originPoint!,
        destinationPoint: newest.destinationPoint!,
        trips: cluster.length,
        lastAt: newest.timestamp,
        distanceMeters: distances[Math.floor(distances.length / 2)],
      }
    })
    .sort((a, b) => b.trips - a.trips || b.lastAt - a.lastAt)
}

/**
 * A frase que acompanha um lugar frequente.
 *
 * Descreve o que foi OBSERVADO, sem adivinhar o porquê. O app não diz "sua
 * casa" nem "seu trabalho": ele não sabe, e errar isso é constrangedor de um
 * jeito difícil de desfazer. Se o usuário quiser nomear um lugar assim, o
 * caminho é salvá-lo — que já existe.
 */
export function describeFrequentPlace(place: FrequentPlace): string {
  const vezes = `${place.visits} trajetos`
  if (place.timeBand) return `${vezes} · quase sempre ${TIME_BAND_LABEL[place.timeBand]}`
  return vezes
}

/**
 * Último destino, para "refazer a última rota".
 *
 * Separado dos padrões de propósito: não exige repetição nenhuma e responde
 * outra pergunta — "voltar para onde eu estava indo" —, que é o caso mais comum
 * de todos logo depois de abrir o app.
 */
export function lastTrip(entries: ActivityEntry[]): ActivityEntry | null {
  return entries.find((entry) => entry.destinationPoint != null) ?? null
}
