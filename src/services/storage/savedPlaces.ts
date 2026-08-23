import type { LngLat } from '@/config/region'

/**
 * Persistência local de lugares salvos (MVP — sem backend/conta). localStorage
 * é suficiente neste estágio: dados pequenos, síncronos, por dispositivo.
 * Se no futuro precisarmos sincronizar entre dispositivos, trocar por uma
 * API própria só exige reescrever este arquivo — nenhum componente conhece
 * o mecanismo de armazenamento.
 */

export type SavedPlaceKind = 'home' | 'work' | 'favorite'

export interface SavedPlace {
  id: string
  kind: SavedPlaceKind
  label: string
  secondaryLabel?: string
  point: LngLat
  savedAt: number
}

const STORAGE_KEY = 'gps-scooter:saved-places'

function readAll(): SavedPlace[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as SavedPlace[]) : []
  } catch {
    return []
  }
}

function writeAll(places: SavedPlace[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(places))
  } catch {
    // localStorage indisponível (modo privado, quota etc.) — falha silenciosa, não é crítico para o app funcionar.
  }
}

export function listSavedPlaces(): SavedPlace[] {
  return readAll().sort((a, b) => a.savedAt - b.savedAt)
}

export function getSavedPlace(kind: Exclude<SavedPlaceKind, 'favorite'>): SavedPlace | null {
  return readAll().find((place) => place.kind === kind) ?? null
}

export function saveSinglePlace(kind: Exclude<SavedPlaceKind, 'favorite'>, label: string, secondaryLabel: string | undefined, point: LngLat): SavedPlace {
  const places = readAll().filter((place) => place.kind !== kind)
  const entry: SavedPlace = { id: `${kind}-${Date.now()}`, kind, label, secondaryLabel, point, savedAt: Date.now() }
  writeAll([...places, entry])
  return entry
}

export function saveFavorite(label: string, secondaryLabel: string | undefined, point: LngLat): SavedPlace {
  const entry: SavedPlace = { id: `favorite-${Date.now()}`, kind: 'favorite', label, secondaryLabel, point, savedAt: Date.now() }
  writeAll([...readAll(), entry])
  return entry
}

export function removeSavedPlace(id: string) {
  writeAll(readAll().filter((place) => place.id !== id))
}
