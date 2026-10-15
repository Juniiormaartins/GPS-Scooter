import { mobilityProfile, PEDESTRIAN_WAY_KINDS } from '@/config/mobilityProfiles'
import type { VehicleModelId } from '@/config/userPreferences'
import type { WayKind } from '@/types/routing'
import { getUserPreferences } from '@/config/userPreferences'
import { learnedSpeed } from '@/services/storage/tripLog'

/**
 * Velocidade que o ETA deve usar: a MÉDIA REAL aprendida das viagens do
 * usuário, quando já há viagens suficientes, e a de referência (o máximo do
 * veículo) quando não há. Ver `storage/tripLog.ts` para o porquê.
 *
 * É separada da velocidade de referência de propósito: a referência continua
 * sendo o que o VEÍCULO faz (entra na classificação de tráfego rápido e na
 * autonomia); esta é o que o USUÁRIO faz, e só o relógio precisa dela.
 */
export function etaSpeedKmh(referenceSpeedKmh: number = getUserPreferences().referenceSpeedKmh): number {
  return learnedSpeed(referenceSpeedKmh)?.kmh ?? referenceSpeedKmh
}

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
  referenceSpeedKmh: number = etaSpeedKmh(),
): number {
  if (distanceMeters <= 0 || referenceSpeedKmh <= 0) return 0

  const distanceKm = distanceMeters / 1000
  const hours = distanceKm / referenceSpeedKmh
  return hours * 60
}

/**
 * ETA sensível ao TIPO DE VIA.
 *
 * O problema concreto: uma rota pode incluir trechos de calçada ou calçadão,
 * e o Valhalla os cronometra como se fossem percorridos a pé — 101 minutos
 * para 8 km, numa medição real. Ignorar isso e aplicar a velocidade de
 * cruzeiro a tudo seria o erro oposto: ninguém atravessa uma calçada na
 * velocidade máxima do veículo.
 *
 * Então o tempo é somado por trecho: velocidade de referência do veículo na
 * via, e a velocidade de espaço de pedestre do perfil (6–8 km/h) em calçada,
 * calçadão e caminho. É o que faz a rota por calçada aparecer com um tempo
 * plausível — nem o do pedestre, nem o da via livre.
 *
 * Sem `wayKind` (rota ainda não enriquecida), cai na conta simples de sempre.
 */
export function calculateRouteEtaMinutes(
  segments: { distanceMeters: number; wayKind?: WayKind }[],
  totalDistanceMeters: number,
  vehicleModelId: VehicleModelId = getUserPreferences().vehicleModelId,
  referenceSpeedKmh: number = getUserPreferences().referenceSpeedKmh,
): number {
  const profile = mobilityProfile(vehicleModelId)
  // `referenceSpeedKmh` é a do veículo; o tempo usa a média aprendida dela.
  const cruiseKmh = etaSpeedKmh(referenceSpeedKmh)
  const known = segments.filter((segment) => segment.wayKind != null)
  if (known.length === 0) return calculateEtaMinutes(totalDistanceMeters, cruiseKmh)

  let minutes = 0
  let accounted = 0
  for (const segment of segments) {
    const isPedestrianSpace = segment.wayKind != null && PEDESTRIAN_WAY_KINDS.includes(segment.wayKind)
    const speed = isPedestrianSpace ? profile.pedestrianWaySpeedKmh : cruiseKmh
    minutes += calculateEtaMinutes(segment.distanceMeters, speed)
    accounted += segment.distanceMeters
  }

  // Os segmentos podem não somar exatamente a distância total (arredondamento
  // do provedor). O resto vai na velocidade de referência.
  const remainder = totalDistanceMeters - accounted
  if (remainder > 0) minutes += calculateEtaMinutes(remainder, cruiseKmh)

  return minutes
}
