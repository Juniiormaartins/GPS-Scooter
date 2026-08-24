/**
 * Preferências do usuário (MVP — sem backend/conta, localStorage). Diferente
 * do VEHICLE_PROFILE (características do veículo), isto é uma preferência
 * de COMO recomendar entre rotas elegíveis — nunca usado para liberar uma
 * via que a classificação considera inadequada, só para decidir o
 * equilíbrio entre adequação e velocidade na escolha da recomendada
 * (ver RECOMMENDATION_TOLERANCE em services/routing/index.ts).
 */

export type RoutePreference = 'tranquil' | 'balanced' | 'fast'
export type ThemeMode = 'dark' | 'light'

/** Modelos oferecidos na seleção de veículo. `custom` guarda o que o usuário ajustar manualmente. */
export type VehicleModelId = 'scooter-32' | 'scooter-25' | 'ebike-25' | 'custom'

export interface VehicleModelPreset {
  id: VehicleModelId
  label: string
  topSpeedKmh: number
  rangeKm: number
}

/**
 * Presets de veículo. Os números são de catálogo (não medições) e alimentam
 * ETA e estimativa de autonomia — por isso mudar o veículo muda de verdade o
 * comportamento do app, não é rótulo decorativo.
 */
export const VEHICLE_PRESETS: VehicleModelPreset[] = [
  { id: 'scooter-32', label: 'Scooter elétrica (autopropelido)', topSpeedKmh: 32, rangeKm: 40 },
  { id: 'scooter-25', label: 'Patinete elétrico urbano', topSpeedKmh: 25, rangeKm: 30 },
  { id: 'ebike-25', label: 'Bicicleta elétrica', topSpeedKmh: 25, rangeKm: 60 },
]

export interface UserPreferences {
  routePreference: RoutePreference
  theme: ThemeMode
  vehicleModelId: VehicleModelId
  /** Velocidade de referência efetiva (km/h) — usada no cálculo de ETA. */
  referenceSpeedKmh: number
  /** Autonomia estimada efetiva (km). */
  rangeKm: number
}

const STORAGE_KEY = 'gps-scooter:preferences'

const DEFAULT_PREFERENCES: UserPreferences = {
  routePreference: 'balanced',
  theme: 'dark',
  vehicleModelId: 'scooter-32',
  referenceSpeedKmh: 32,
  rangeKm: 40,
}

export function getUserPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_PREFERENCES
    return { ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<UserPreferences>) }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

export function setUserPreferences(preferences: UserPreferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
  } catch {
    // localStorage indisponível — a preferência só não persiste entre sessões, não é crítico.
  }
}

/** Tolerância (em pontos) usada por rankRoutes para decidir entre segurança e velocidade — ver services/routing/index.ts. */
export const ROUTE_PREFERENCE_TOLERANCE: Record<RoutePreference, number> = {
  tranquil: 2,
  balanced: 5,
  fast: 15,
}

/**
 * Rótulo do veículo ativo. Fonte única de verdade para a UI: quando o usuário
 * escolhe outro modelo no Perfil, TODAS as telas passam a mostrar este valor.
 *
 * `custom` aparece quando velocidade/autonomia foram ajustadas à mão, saindo
 * de qualquer preset — nesse caso o rótulo descreve o que foi configurado em
 * vez de mentir dizendo que ainda é um dos modelos prontos.
 */
export function resolveVehicleLabel(preferences: UserPreferences): string {
  const preset = VEHICLE_PRESETS.find((entry) => entry.id === preferences.vehicleModelId)
  if (preset) return preset.label
  return `Veículo personalizado · ${preferences.referenceSpeedKmh} km/h`
}
