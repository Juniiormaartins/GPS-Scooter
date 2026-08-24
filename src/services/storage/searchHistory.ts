import type { LngLat } from '@/config/region'
import type { GeocodingResult } from '@/services/geocoding'

/**
 * Histórico local de destinos já pesquisados (localStorage, sem backend —
 * mesmo padrão de savedPlaces.ts e activityHistory.ts).
 *
 * Existe por dois motivos, ambos vindos de uso real:
 * 1. voltar a um destino recorrente sem pesquisar de novo;
 * 2. contornar uma limitação concreta dos provedores de busca — vários
 *    estabelecimentos só aparecem quando se digita quase o nome inteiro
 *    ("Posto Líder" não vem em "Pos"). Como o histórico é nosso e local, ele
 *    casa por prefixo/trecho instantaneamente e entra ANTES dos resultados
 *    externos (ver hooks/useAddressSuggestions.ts).
 */

export interface SearchHistoryEntry {
  id: string
  label: string
  secondaryLabel?: string
  point: LngLat
  searchedAt: number
}

const STORAGE_KEY = 'gps-scooter:search-history'
const MAX_ENTRIES = 30

function readAll(): SearchHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as SearchHistoryEntry[]) : []
  } catch {
    return []
  }
}

function writeAll(entries: SearchHistoryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // localStorage indisponível (modo privado, quota) — o histórico é conveniência, não pode quebrar a busca.
  }
}

/** Mais recentes primeiro. */
export function listSearchHistory(): SearchHistoryEntry[] {
  return readAll().sort((a, b) => b.searchedAt - a.searchedAt)
}

/**
 * Registra um destino escolhido. Se o mesmo lugar já estiver no histórico
 * (mesma coordenada, com tolerância), a entrada é atualizada em vez de
 * duplicada — assim o histórico reflete "lugares", não "vezes que pesquisei".
 */
export function recordSearch(result: GeocodingResult) {
  const isSamePlace = (entry: SearchHistoryEntry) =>
    Math.abs(entry.point.lat - result.point.lat) < 1e-5 && Math.abs(entry.point.lng - result.point.lng) < 1e-5

  const entries = readAll().filter((entry) => !isSamePlace(entry))
  entries.push({
    id: `search-${Date.now()}`,
    label: result.label,
    secondaryLabel: result.secondaryLabel,
    point: result.point,
    searchedAt: Date.now(),
  })

  writeAll(entries.sort((a, b) => b.searchedAt - a.searchedAt).slice(0, MAX_ENTRIES))
}

export function removeSearchHistoryEntry(id: string) {
  writeAll(readAll().filter((entry) => entry.id !== id))
}

export function clearSearchHistory() {
  writeAll([])
}

/** Remove acentos e caixa para comparar "Líder" com "lider". */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

/**
 * Entradas do histórico que casam com o que está sendo digitado. Casa por
 * PREFIXO de qualquer palavra do nome — é o que faz "Pos" encontrar
 * "Posto Líder" instantaneamente, sem depender do provedor externo.
 */
export function matchSearchHistory(query: string): SearchHistoryEntry[] {
  const normalizedQuery = normalize(query)
  if (!normalizedQuery) return []

  return listSearchHistory().filter((entry) => {
    const label = normalize(entry.label)
    if (label.startsWith(normalizedQuery) || label.includes(normalizedQuery)) return true
    return label.split(/\s+/).some((word) => word.startsWith(normalizedQuery))
  })
}
