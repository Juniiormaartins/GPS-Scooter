/**
 * Preferências do usuário (MVP — sem backend/conta, localStorage). Diferente
 * do VEHICLE_PROFILE (características do veículo), isto é uma preferência
 * de COMO recomendar entre rotas elegíveis — nunca usado para liberar uma
 * via que a classificação considera inadequada, só para decidir o
 * equilíbrio entre adequação e velocidade na escolha da recomendada
 * (ver RECOMMENDATION_TOLERANCE em services/routing/index.ts).
 */

export type RoutePreference = 'tranquil' | 'balanced' | 'fast'

export interface UserPreferences {
  routePreference: RoutePreference
}

const STORAGE_KEY = 'gps-scooter:preferences'

const DEFAULT_PREFERENCES: UserPreferences = { routePreference: 'balanced' }

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
