/**
 * DADOS DE DEMONSTRAÇÃO — NÃO é uma integração real de navegação turn-by-turn.
 * Fornece um "próximo passo" estático apenas para validar o visual do modo de
 * navegação (Estado D), inspirado no protótipo do Google Stitch. A lógica real
 * (recálculo por posição GPS, detecção de manobra, avanço de instrução) ainda
 * não existe e deve substituir este módulo inteiramente quando implementada —
 * nenhum outro componente deve depender deste formato além do shape de
 * NavigationStep.
 */

export type ManeuverType = 'turn-left' | 'turn-right' | 'straight' | 'arrive'

export interface NavigationStep {
  maneuver: ManeuverType
  instruction: string
  distanceToManeuverMeters: number
}

export function getMockNavigationStep(): NavigationStep {
  return {
    maneuver: 'turn-right',
    instruction: 'Vire à direita na Av. T-9',
    distanceToManeuverMeters: 240,
  }
}
