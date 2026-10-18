import type { LngLat } from '@/config/region'
import { haversineDistanceMeters } from '@/utils/geo'

/**
 * Remove os primeiros `skipMeters` de uma sequência de trechos encadeados (a rota
 * dividida em segmentos), devolvendo só o que ainda está à frente. O corte cai
 * no ponto exato (interpolado) e não no vértice mais próximo, para a ponta do
 * traçado acompanhar o marcador sem pular.
 */
export function trimPathsFromStart(paths: LngLat[][], skipMeters: number): LngLat[][] {
  if (!(skipMeters > 0)) return paths
  let remaining = skipMeters
  const result: LngLat[][] = []
  for (const path of paths) {
    if (remaining <= 0) {
      result.push(path)
      continue
    }
    let kept: LngLat[] | null = null
    for (let i = 1; i < path.length; i += 1) {
      const length = haversineDistanceMeters(path[i - 1], path[i])
      if (kept) {
        kept.push(path[i])
      } else if (remaining < length) {
        const t = length === 0 ? 0 : remaining / length
        const cut = {
          lng: path[i - 1].lng + (path[i].lng - path[i - 1].lng) * t,
          lat: path[i - 1].lat + (path[i].lat - path[i - 1].lat) * t,
        }
        kept = [cut, path[i]]
        remaining = 0
      } else {
        remaining -= length
      }
    }
    if (kept && kept.length >= 2) result.push(kept)
  }
  return result
}
