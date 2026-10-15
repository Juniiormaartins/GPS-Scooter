import type { OverpassWay } from '@/services/routing/segmentEnrichment'

/**
 * CACHE PERSISTENTE DAS VIAS — o que faz o trajeto de todo dia se classificar
 * sozinho.
 *
 * O PROBLEMA. A classificação por trecho depende das tags do OpenStreetMap, que
 * vêm do Overpass público. Ele é um serviço gratuito e compartilhado: mede-se
 * 504 depois de 10 s numa consulta de 4 km² e outros espelhos que nem
 * respondem. Quando falha, a rota fica sem classificação — e o app não sabe
 * dizer qual é a mais recomendada.
 *
 * O cache anterior era `sessionStorage`: some quando o app é fechado. Quem faz
 * casa → trabalho todo dia nunca aproveitava nada do dia anterior, embora a
 * malha viária desse corredor seja exatamente a mesma (as vias mudam em escala
 * de semanas, não de horas).
 *
 * O QUE ESTE MÓDULO FAZ. Guarda no IndexedDB a resposta de cada ÁREA consultada
 * e responde "alguma área guardada cobre este retângulo?". Na segunda vez que o
 * trajeto é pedido, a classificação sai do aparelho, na hora, sem rede — e
 * funciona mesmo quando o Overpass está fora.
 *
 * POR QUE INDEXEDDB. Uma consulta de 4 km² pesa ~600 KB; uma de 6 km de rota,
 * alguns MB. O `localStorage` tem ~5 MB para o app inteiro e já guarda
 * preferências e histórico. O IndexedDB tem folga de centenas de MB.
 *
 * COMPACTO. Guarda só as 11 tags que a classificação lê e coordenadas com 5
 * casas (≈1 m) — a tolerância do casamento de trecho com via é de dezenas de
 * metros. Reduz o tamanho a menos da metade.
 *
 * NUNCA LANÇA. Cache é otimização: se o IndexedDB não existir (modo privado,
 * navegador antigo) ou falhar, tudo continua como antes, só sem a economia.
 */

export interface BoundingBox {
  south: number
  west: number
  north: number
  east: number
}

interface CompactWay {
  t: Record<string, string>
  g: [number, number][]
}

interface StoredArea {
  key: string
  bbox: BoundingBox
  savedAt: number
  ways: CompactWay[]
}

interface IndexEntry {
  key: string
  bbox: BoundingBox
  savedAt: number
}

const DB_NAME = 'gps-scooter'
const STORE = 'ways'
const INDEX_KEY = 'gps-scooter:ways-index'

/**
 * Validade. A malha de uma cidade muda devagar, e uma via nova ou reclassificada
 * não torna a classificação antiga PERIGOSA — só desatualizada. Passado o
 * prazo o dado ainda serve de reserva se a rede falhar (ver `fresh`).
 */
const FRESH_MS = 21 * 24 * 60 * 60 * 1000

/** Áreas guardadas. Cada uma pode ter alguns MB; dez cobrem os corredores de uso diário. */
const MAX_AREAS = 10

const KEPT_TAGS = ['highway', 'ref', 'name', 'maxspeed', 'motorroad', 'bicycle', 'foot', 'lanes', 'oneway', 'surface', 'access']

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponível'))
      return
    }
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'key' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  // Uma falha de abertura não pode ficar presa para sempre: a próxima chamada tenta de novo.
  dbPromise.catch(() => {
    dbPromise = null
  })
  return dbPromise
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function readIndex(): IndexEntry[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY)
    return raw ? (JSON.parse(raw) as IndexEntry[]) : []
  } catch {
    return []
  }
}

function writeIndex(entries: IndexEntry[]) {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(entries))
  } catch {
    // Sem localStorage o cache simplesmente não é encontrado depois — não é crítico.
  }
}

function contem(externo: BoundingBox, interno: BoundingBox): boolean {
  return (
    externo.south <= interno.south &&
    externo.west <= interno.west &&
    externo.north >= interno.north &&
    externo.east >= interno.east
  )
}

function compact(ways: OverpassWay[]): CompactWay[] {
  return ways.map((way) => {
    const t: Record<string, string> = {}
    for (const tag of KEPT_TAGS) {
      const value = way.tags?.[tag]
      if (value != null) t[tag] = value
    }
    const g: [number, number][] = (way.geometry ?? []).map((node) => [
      Math.round(node.lat * 1e5) / 1e5,
      Math.round(node.lon * 1e5) / 1e5,
    ])
    return { t, g }
  })
}

function expand(ways: CompactWay[]): OverpassWay[] {
  return ways.map((way) => ({
    tags: way.t,
    geometry: way.g.map(([lat, lon]) => ({ lat, lon })),
  })) as OverpassWay[]
}

export interface StoredWays {
  ways: OverpassWay[]
  /** Dentro da validade. `false` = antigo: só deve ser usado se a rede falhar. */
  fresh: boolean
}

/**
 * Procura uma área guardada que cubra o retângulo pedido. Prefere a mais nova.
 * Devolve `null` quando não há nenhuma — e também quando o IndexedDB falha.
 */
export async function findStoredWays(bbox: BoundingBox): Promise<StoredWays | null> {
  try {
    const candidatos = readIndex()
      .filter((entry) => contem(entry.bbox, bbox))
      .sort((a, b) => b.savedAt - a.savedAt)
    if (candidatos.length === 0) return null

    const db = await openDb()
    for (const entry of candidatos) {
      const stored = (await requestToPromise(db.transaction(STORE, 'readonly').objectStore(STORE).get(entry.key))) as
        | StoredArea
        | undefined
      if (!stored) continue
      return { ways: expand(stored.ways), fresh: Date.now() - stored.savedAt < FRESH_MS }
    }
    return null
  } catch {
    return null
  }
}

/** Guarda uma área consultada e descarta as mais antigas além do limite. */
export async function storeWays(key: string, bbox: BoundingBox, ways: OverpassWay[]): Promise<void> {
  // Resposta vazia não é cache: pode ser uma falha disfarçada de "sem vias", e
  // guardá-la deixaria a região sem classificação por semanas.
  if (ways.length === 0) return
  try {
    const db = await openDb()
    const record: StoredArea = { key, bbox, savedAt: Date.now(), ways: compact(ways) }
    await requestToPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).put(record))

    const index = readIndex().filter((entry) => entry.key !== key)
    index.push({ key, bbox, savedAt: record.savedAt })
    index.sort((a, b) => b.savedAt - a.savedAt)

    const excedentes = index.splice(MAX_AREAS)
    writeIndex(index)
    for (const antigo of excedentes) {
      await requestToPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(antigo.key)).catch(() => {})
    }
  } catch {
    // Quota cheia ou IndexedDB bloqueado: segue sem cache.
  }
}
