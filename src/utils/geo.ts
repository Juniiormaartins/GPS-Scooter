import type { LngLat } from '@/config/region'

const EARTH_RADIUS_METERS = 6371000

/** Distância aproximada em metros entre dois pontos (fórmula de Haversine). */
export function haversineDistanceMeters(a: LngLat, b: LngLat): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h))
}

export interface PolylineProjection {
  /** Ponto mais próximo na polyline. */
  point: LngLat
  /** Distância acumulada ao longo da polyline até o ponto projetado. */
  distanceAlongMeters: number
  /** Distância perpendicular entre a posição original e a polyline (o quão "fora da rota" o ponto está). */
  distanceFromPathMeters: number
}

/**
 * Projeta um ponto (ex: posição atual do GPS) sobre a polyline mais próxima,
 * caminhando por cada segmento reto entre pontos consecutivos. Base para a
 * navegação dinâmica: saber "onde na rota" o usuário está agora e o quão
 * longe ele se desviou dela.
 */
export function projectPointOntoPath(point: LngLat, path: LngLat[]): PolylineProjection | null {
  if (path.length === 0) return null
  if (path.length === 1) {
    return { point: path[0], distanceAlongMeters: 0, distanceFromPathMeters: haversineDistanceMeters(point, path[0]) }
  }

  let best: PolylineProjection | null = null
  let cumulativeDistance = 0

  for (let i = 0; i < path.length - 1; i++) {
    const segmentStart = path[i]
    const segmentEnd = path[i + 1]
    const segmentLength = haversineDistanceMeters(segmentStart, segmentEnd)

    const projected = projectOntoSegment(point, segmentStart, segmentEnd)
    const distanceFromPath = haversineDistanceMeters(point, projected)

    if (!best || distanceFromPath < best.distanceFromPathMeters) {
      best = {
        point: projected,
        distanceAlongMeters: cumulativeDistance + haversineDistanceMeters(segmentStart, projected),
        distanceFromPathMeters: distanceFromPath,
      }
    }

    cumulativeDistance += segmentLength
  }

  return best
}

/** Projeta `point` sobre o segmento reto [a, b] usando aproximação planar local (precisa o suficiente em escala urbana). */
function projectOntoSegment(point: LngLat, a: LngLat, b: LngLat): LngLat {
  const dx = b.lng - a.lng
  const dy = b.lat - a.lat
  const lengthSquared = dx * dx + dy * dy

  if (lengthSquared === 0) return a

  const t = Math.max(0, Math.min(1, ((point.lng - a.lng) * dx + (point.lat - a.lat) * dy) / lengthSquared))
  return { lng: a.lng + t * dx, lat: a.lat + t * dy }
}

/** Posição interpolada na polyline a uma dada distância acumulada do início. */
export function pointAtDistanceAlongPath(path: LngLat[], distanceMeters: number): LngLat {
  if (path.length === 0) return { lng: 0, lat: 0 }
  if (distanceMeters <= 0) return path[0]

  let traveled = 0
  for (let i = 0; i < path.length - 1; i++) {
    const segmentLength = haversineDistanceMeters(path[i], path[i + 1])
    if (traveled + segmentLength >= distanceMeters) {
      const ratio = segmentLength === 0 ? 0 : (distanceMeters - traveled) / segmentLength
      return {
        lng: path[i].lng + (path[i + 1].lng - path[i].lng) * ratio,
        lat: path[i].lat + (path[i + 1].lat - path[i].lat) * ratio,
      }
    }
    traveled += segmentLength
  }
  return path[path.length - 1]
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}

export function formatEta(minutes: number): string {
  if (minutes < 1) return '< 1 min'
  if (minutes < 60) return `${Math.round(minutes)} min`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = Math.round(minutes % 60)
  return `${hours}h ${remainingMinutes}min`
}

/**
 * Rumo (bearing) de `from` para `to`, em graus 0–360 no sentido horário a
 * partir do norte — o mesmo referencial que o MapLibre usa em `bearing` e que
 * a Geolocation API usa em `coords.heading`.
 *
 * Serve de FALLBACK para quando o dispositivo não fornece heading: em muitos
 * aparelhos `coords.heading` só vem preenchido em movimento, e vem `null`
 * parado ou em GPS de baixa precisão. Derivar do deslocamento entre duas
 * posições é a única fonte honesta nesse caso — quando nem isso existe
 * (posições iguais), quem chama mantém o rumo anterior em vez de inventar.
 */
export function computeBearingDegrees(from: LngLat, to: LngLat): number {
  const toRad = (value: number) => (value * Math.PI) / 180
  const toDeg = (value: number) => (value * 180) / Math.PI

  const lat1 = toRad(from.lat)
  const lat2 = toRad(to.lat)
  const deltaLng = toRad(to.lng - from.lng)

  const y = Math.sin(deltaLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng)

  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

/**
 * Duas coordenadas descrevem o mesmo lugar?
 *
 * A tolerância de 1e-6 grau (~11 cm) existe porque as coordenadas passam por
 * serialização (localStorage, JSON dos provedores) e voltam com o último
 * dígito diferente. Comparar com `===` faria o mesmo destino parecer outro.
 */
export function isSamePoint(a: LngLat | null, b: LngLat | null): boolean {
  if (!a || !b) return false
  return Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lng - b.lng) < 1e-6
}
