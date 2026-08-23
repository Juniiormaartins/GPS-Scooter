/**
 * Histórico local de rotas calculadas (MVP — sem backend/conta).
 * Gravado automaticamente sempre que uma rota é calculada com sucesso
 * (ver App.tsx). Cap de MAX_ENTRIES para não crescer indefinidamente.
 */

export interface ActivityEntry {
  id: string
  originLabel: string
  destinationLabel: string
  distanceMeters: number
  etaMinutes: number
  suitabilityScore: number
  timestamp: number
}

const STORAGE_KEY = 'gps-scooter:activity'
const MAX_ENTRIES = 50

function readAll(): ActivityEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ActivityEntry[]) : []
  } catch {
    return []
  }
}

export function listActivity(): ActivityEntry[] {
  return readAll().sort((a, b) => b.timestamp - a.timestamp)
}

export function recordActivity(entry: Omit<ActivityEntry, 'id' | 'timestamp'>) {
  try {
    const next: ActivityEntry = { ...entry, id: `activity-${Date.now()}`, timestamp: Date.now() }
    const all = [next, ...readAll()].slice(0, MAX_ENTRIES)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    // localStorage indisponível — não é crítico, só perde o registro deste trajeto.
  }
}

export function clearActivity() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignora
  }
}
