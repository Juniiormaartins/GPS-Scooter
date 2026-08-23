import { VEHICLE_PROFILE } from '@/config/vehicle'

/**
 * ETA = distância ÷ velocidade de referência do veículo.
 * Implementação inicial deliberadamente simples (velocidade constante).
 * Pontos de extensão futuros (não implementados agora): semáforos, cruzamentos,
 * tipo de via, tráfego, aclives — devem ser incorporados aqui como fatores de
 * ajuste, sem alterar a assinatura pública desta função.
 */
export function calculateEtaMinutes(
  distanceMeters: number,
  referenceSpeedKmh: number = VEHICLE_PROFILE.maxOperationalSpeedKmh,
): number {
  if (distanceMeters <= 0 || referenceSpeedKmh <= 0) return 0

  const distanceKm = distanceMeters / 1000
  const hours = distanceKm / referenceSpeedKmh
  return hours * 60
}
