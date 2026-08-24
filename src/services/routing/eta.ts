import { getUserPreferences } from '@/config/userPreferences'

/**
 * ETA = distância ÷ velocidade de referência do veículo.
 * Implementação inicial deliberadamente simples (velocidade constante).
 * Pontos de extensão futuros (não implementados agora): semáforos, cruzamentos,
 * tipo de via, tráfego, aclives — devem ser incorporados aqui como fatores de
 * ajuste, sem alterar a assinatura pública desta função.
 *
 * A velocidade padrão vem das PREFERÊNCIAS do usuário (Perfil → velocidade de
 * referência), não de uma constante — é o que faz a configuração de veículo
 * ter efeito real sobre os tempos exibidos em todo o app.
 */
export function calculateEtaMinutes(
  distanceMeters: number,
  referenceSpeedKmh: number = getUserPreferences().referenceSpeedKmh,
): number {
  if (distanceMeters <= 0 || referenceSpeedKmh <= 0) return 0

  const distanceKm = distanceMeters / 1000
  const hours = distanceKm / referenceSpeedKmh
  return hours * 60
}
