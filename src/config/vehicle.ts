/**
 * Perfil centralizado do veículo autopropelido.
 * Toda regra de negócio relacionada a velocidade/limites do veículo deve
 * referenciar este arquivo — nunca duplicar o valor de velocidade em outro lugar.
 *
 * Importante: capacidade técnica ≠ regra de circulação. Um veículo pode ser
 * tecnicamente capaz de mais que `maxOperationalSpeedKmh` — isso não deve
 * nunca ser usado para liberar vias que a classificação considera
 * inadequadas; serve apenas para cálculos de desempenho/autonomia (ETA de
 * pior caso, por exemplo). Hoje só existe um perfil fixo; a arquitetura já
 * separa os dois campos para permitir, no futuro, múltiplos veículos com
 * capacidades técnicas diferentes sem alterar as regras de adequação de via.
 */

export type VehicleType = 'self-propelled-scooter'

export interface VehicleProfile {
  type: VehicleType
  /** Capacidade técnica máxima do hardware (km/h) — característica do veículo, não uma autorização de circulação. */
  technicalTopSpeedKmh: number
  /** Velocidade de referência usada no cálculo de ETA e nas regras de circulação. */
  maxOperationalSpeedKmh: number
  /**
   * Autonomia estimada com carga cheia (km) — usada apenas para estimar
   * consumo/bateria restante (services/vehicle/batteryEstimate.ts). É uma
   * suposição de catálogo, não uma medição; nunca apresentar como precisa.
   * Não incorpora inclinação/superfície ainda (ver nota de elevação abaixo).
   */
  estimatedRangeKm: number
  /** Rótulo amigável exibido na interface. */
  label: string
  /** Contexto de uso principal — usado para orientar a seleção de vias. */
  usageContext: 'urban'
}

export const VEHICLE_PROFILE: VehicleProfile = {
  type: 'self-propelled-scooter',
  technicalTopSpeedKmh: 32,
  maxOperationalSpeedKmh: 32,
  estimatedRangeKm: 40,
  label: 'Scooter elétrica (autopropelido)',
  usageContext: 'urban',
}

/**
 * Ponto de extensão futuro (não implementado): dados de elevação (subida,
 * descida, ganho acumulado) para ajustar a autonomia estimada e a velocidade
 * esperada por trecho. Exigiria uma fonte de dados de elevação por segmento
 * (ex: enriquecimento adicional via Overpass/SRTM) — não inventar esse dado
 * enquanto não houver uma fonte confiável; até lá, batteryEstimate.ts usa um
 * modelo linear simples (distância ÷ autonomia), sem considerar terreno.
 */
