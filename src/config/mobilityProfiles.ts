import type { VehicleModelId } from '@/config/userPreferences'
import type { SuitabilityTier, WayKind } from '@/types/routing'

/**
 * PERFIS DE MOBILIDADE — a fonte única do que cada veículo pode, deve e não
 * deveria usar.
 *
 * POR QUE ISTO EXISTE. A classificação de vias tratava os três veículos com a
 * MESMA tabela (`TIER_BY_ROAD_CLASS`), diferenciando-os só por dois ajustes a
 * posteriori: diferencial de velocidade e sensibilidade a piso solto. Na
 * prática, patinete, bicicleta elétrica e scooter recebiam a mesma leitura de
 * uma avenida, de uma ciclovia e de uma calçada — e as três coisas são
 * radicalmente diferentes conforme o que se está pilotando.
 *
 * Pior: calçada, ciclovia, caminho e escada nem existiam na classificação. O
 * tipo de via só ia até `service`, então toda a malha de pedestre e ciclista
 * caía em `unknown` e era tratada como "boa" indiscriminadamente — para os
 * três veículos, inclusive para a scooter, que não tem o que fazer numa
 * passarela.
 *
 * Aqui cada perfil declara sua própria tabela. Não há condicional por veículo
 * espalhada pelo classificador: ele lê a tabela do perfil ativo.
 *
 * O EIXO NÃO É BINÁRIO. Cada via recebe um dos cinco níveis já existentes no
 * projeto (very-good → prohibited), que a interface já traduz em verde,
 * âmbar e vermelho. Nada de "pode/não pode".
 *
 * SOBRE 'prohibited': continua reservado a impossibilidade FÍSICA ou a sinal
 * explícito do OSM. Escada é impossível de pilotar — isso não é regra legal
 * inventada, é geometria. Rodovia para patinete é `unsuitable`: fortemente
 * desaconselhada, visível, penalizada, mas não apagada da interface (ver
 * item "vias perigosas continuam visíveis").
 */

/** Motivo legível da classificação — é o que a interface mostra em vez de só uma cor. */
export type SuitabilityReasonCode =
  | 'ideal-infrastructure'
  | 'local-street'
  | 'urban-road'
  | 'shared-with-traffic'
  | 'high-speed-traffic'
  | 'arterial-road'
  | 'expressway'
  | 'pedestrian-space'
  | 'loose-surface'
  | 'not-rideable'
  | 'access-restricted'
  | 'no-data'

export const REASON_TEXT: Record<SuitabilityReasonCode, string> = {
  'ideal-infrastructure': 'Infraestrutura própria para o veículo',
  'local-street': 'Via local de tráfego lento',
  'urban-road': 'Via urbana comum',
  'shared-with-traffic': 'Compartilhada com tráfego — exige atenção',
  'high-speed-traffic': 'Tráfego em velocidade muito acima da sua',
  /*
    Arterial NÃO é rodovia. Uma via `primary` chamada "Rua 83" é uma avenida
    urbana movimentada: ruim para patinete, mas chamá-la de rodovia na tela
    seria descrever errado o que o usuário está vendo pela janela. Só
    motorway/trunk, `motorroad=yes` e ref BR- viram 'expressway'.
  */
  'arterial-road': 'Via arterial de tráfego intenso para este veículo',
  expressway: 'Via expressa ou rodovia — inadequada para este veículo',
  'pedestrian-space': 'Espaço de pedestre — circule devagar e dê preferência',
  'loose-surface': 'Piso solto — pouca aderência para as rodas deste veículo',
  'not-rideable': 'Trecho impossível de percorrer sobre o veículo',
  'access-restricted': 'Acesso restrito segundo os dados da via',
  'no-data': 'Sem dados da via',
}

export interface MobilityProfile {
  id: VehicleModelId
  label: string
  /**
   * Costing pedido ao Valhalla. Medido na instância pública, mesmo trajeto:
   * `bicycle` 9,21 km / sem rodovia; `motor_scooter` 9,22 km / sem rodovia;
   * `pedestrian` 8,05 km / sem rodovia (usa calçadas); `motorcycle` 10,56 km
   * COM rodovia — por isso motocicleta está fora.
   */
  costing: 'bicycle' | 'motor_scooter' | 'pedestrian'
  /**
   * Pedir TAMBÉM candidatas da malha de pedestre.
   *
   * Só o patinete. A pergunta do produto é "existe um caminho por calçada e
   * passarela que encurte o trajeto?", e para o patinete a resposta é
   * legítima. Elas entram no MESMO pool e passam pelo MESMO classificador —
   * não é rota de pedestre renomeada: se o caminho for ruim para patinete,
   * ele perde no ranking como qualquer outra.
   */
  includePedestrianCandidates: boolean
  /**
   * Velocidade de cruzeiro em espaço de pedestre, em km/h.
   *
   * É o que impede o erro que o Valhalla comete quando devolve a rota de
   * pedestre: 8 km em 101 minutos. O patinete não anda a 5 km/h numa calçada,
   * mas também não anda a 25 — vai devagar por prudência, e é esse número.
   */
  pedestrianWaySpeedKmh: number
  /** Diferença de velocidade (km/h) para a via cair um nível por tráfego rápido. */
  speedDifferentialThresholdKmh: number
  /** Sensibilidade a piso solto — roda pequena perde estabilidade onde aro grande não perde. */
  looseSurfaceSensitivity: 'high' | 'medium' | 'low'
  /** Tabela de adequação por tipo de via. É o coração do perfil. */
  wayTiers: Record<WayKind, SuitabilityTier>
}

/**
 * SCOOTER ELÉTRICA — veículo motorizado leve.
 *
 * Anda na via, com o tráfego. Não usa ciclovia (é motorizada), não usa
 * calçada nem passarela. Aguenta bem piso irregular e mantém velocidade
 * suficiente para conviver com avenidas — daí ser a única das três em que
 * `secondary` é boa e o limiar de diferencial é mais alto.
 */
const SCOOTER: MobilityProfile = {
  id: 'scooter-32',
  label: 'Scooter elétrica',
  costing: 'motor_scooter',
  includePedestrianCandidates: false,
  pedestrianWaySpeedKmh: 6,
  speedDifferentialThresholdKmh: 35,
  looseSurfaceSensitivity: 'medium',
  wayTiers: {
    motorway: 'unsuitable',
    trunk: 'unsuitable',
    primary: 'caution',
    secondary: 'good',
    tertiary: 'very-good',
    residential: 'very-good',
    living_street: 'very-good',
    service: 'good',
    // Ciclovia é infraestrutura de bicicleta; scooter motorizada ali é
    // conflito, não atalho.
    cycleway: 'unsuitable',
    footway: 'unsuitable',
    pedestrian: 'unsuitable',
    path: 'unsuitable',
    track: 'caution',
    steps: 'prohibited',
    unknown: 'good',
  },
}

/**
 * PATINETE ELÉTRICO — o perfil que mais se distancia dos outros dois.
 *
 * Roda pequena, velocidade baixa, sem carenagem: uma avenida arterial é
 * genuinamente perigosa, e é por isso que `primary` aqui é `unsuitable` e não
 * `caution` como na scooter. Em compensação, ciclovia e calçada são espaços
 * legítimos — a calçada como `caution`, porque conviver com pedestre exige
 * andar devagar e dar preferência, não porque seja proibido.
 */
const KICK_SCOOTER: MobilityProfile = {
  id: 'scooter-25',
  label: 'Patinete elétrico',
  costing: 'bicycle',
  includePedestrianCandidates: true,
  pedestrianWaySpeedKmh: 8,
  speedDifferentialThresholdKmh: 25,
  looseSurfaceSensitivity: 'high',
  wayTiers: {
    motorway: 'unsuitable',
    trunk: 'unsuitable',
    primary: 'unsuitable',
    secondary: 'caution',
    tertiary: 'good',
    residential: 'very-good',
    living_street: 'very-good',
    service: 'good',
    cycleway: 'very-good',
    footway: 'caution',
    pedestrian: 'caution',
    path: 'caution',
    track: 'caution',
    steps: 'prohibited',
    unknown: 'good',
  },
}

/**
 * BICICLETA ELÉTRICA — perfil de bicicleta, com a velocidade de uma e-bike.
 *
 * Divide quase tudo com a bicicleta comum; o que muda é a velocidade (que
 * entra no ETA e no diferencial de tráfego) e o fato de aguentar caminho de
 * terra batida melhor que um patinete. Calçada fica em `caution` pelo mesmo
 * motivo do patinete, e não melhor: bicicleta em calçada é conflito com
 * pedestre.
 */
const EBIKE: MobilityProfile = {
  id: 'ebike-25',
  label: 'Bicicleta elétrica',
  costing: 'bicycle',
  includePedestrianCandidates: false,
  pedestrianWaySpeedKmh: 8,
  speedDifferentialThresholdKmh: 30,
  looseSurfaceSensitivity: 'low',
  wayTiers: {
    motorway: 'unsuitable',
    trunk: 'unsuitable',
    primary: 'caution',
    secondary: 'good',
    tertiary: 'very-good',
    residential: 'very-good',
    living_street: 'very-good',
    service: 'good',
    cycleway: 'very-good',
    footway: 'caution',
    pedestrian: 'caution',
    path: 'good',
    track: 'good',
    steps: 'prohibited',
    unknown: 'good',
  },
}

/** `custom` herda o perfil da scooter — é de onde o usuário parte ao ajustar à mão. */
const PROFILES: Record<VehicleModelId, MobilityProfile> = {
  'scooter-32': SCOOTER,
  'scooter-25': KICK_SCOOTER,
  'ebike-25': EBIKE,
  custom: { ...SCOOTER, id: 'custom', label: 'Veículo personalizado' },
}

export function mobilityProfile(id: VehicleModelId): MobilityProfile {
  return PROFILES[id] ?? SCOOTER
}

/** Tipos de via que são espaço de pedestre — usados no cálculo de tempo. */
export const PEDESTRIAN_WAY_KINDS: WayKind[] = ['footway', 'pedestrian', 'steps', 'path']
