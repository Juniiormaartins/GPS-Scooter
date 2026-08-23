import { VEHICLE_PROFILE } from '@/config/vehicle'

/**
 * Estimativa de bateria restante — NUNCA uma leitura real do veículo (não
 * existe integração de hardware/BLE nesta fase). Modelo linear simples:
 * consumo proporcional à distância percorrida sobre a autonomia estimada do
 * perfil do veículo. Não considera inclinação, superfície, vento ou estilo
 * de condução — ponto de extensão documentado em config/vehicle.ts.
 *
 * Todo consumidor desta função deve deixar claro na UI que o valor é uma
 * estimativa (ex: "≈82% estimado"), nunca apresentá-lo como leitura precisa.
 */
export interface BatteryEstimate {
  percent: number
  isEstimate: true
}

export function estimateRemainingBatteryPercent(
  startPercent: number,
  distanceTraveledMeters: number,
  rangeKm: number = VEHICLE_PROFILE.estimatedRangeKm,
): BatteryEstimate {
  if (rangeKm <= 0) return { percent: startPercent, isEstimate: true }

  const consumedPercent = (distanceTraveledMeters / 1000 / rangeKm) * 100
  const percent = Math.max(0, Math.min(100, Math.round(startPercent - consumedPercent)))
  return { percent, isEstimate: true }
}
