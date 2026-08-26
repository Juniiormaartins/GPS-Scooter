/**
 * Preferências do usuário (MVP — sem backend/conta, localStorage). Diferente
 * do VEHICLE_PROFILE (características do veículo), isto é uma preferência
 * de COMO recomendar entre rotas elegíveis — nunca usado para liberar uma
 * via que a classificação considera inadequada, só para decidir o
 * equilíbrio entre adequação e velocidade na escolha da recomendada
 * (ver RECOMMENDATION_TOLERANCE em services/routing/index.ts).
 */

export type RoutePreference = 'tranquil' | 'balanced' | 'fast'

/**
 * Condições que o usuário pode pedir para evitar. São PREFERÊNCIAS, não
 * regras: penalizam a rota no ranking, nunca a eliminam nem liberam uma via
 * que as regras obrigatórias consideram inadequada (ver
 * services/routing/avoidances.ts).
 *
 * Só entram nesta lista condições que temos como detectar com dado real. Cada
 * uma tem sua fonte documentada em AVOIDANCE_OPTIONS abaixo.
 */
export type AvoidanceId = 'express-roads' | 'unpaved' | 'steep-climbs' | 'steep-descents'
export type ThemeMode = 'dark' | 'light'

/** Modelos oferecidos na seleção de veículo. `custom` guarda o que o usuário ajustar manualmente. */
export type VehicleModelId = 'scooter-32' | 'scooter-25' | 'ebike-25' | 'custom'

export interface VehicleModelPreset {
  id: VehicleModelId
  label: string
  topSpeedKmh: number
  rangeKm: number
}

/**
 * Presets de veículo. Os números são de catálogo (não medições) e alimentam
 * ETA e estimativa de autonomia — por isso mudar o veículo muda de verdade o
 * comportamento do app, não é rótulo decorativo.
 */
export const VEHICLE_PRESETS: VehicleModelPreset[] = [
  { id: 'scooter-32', label: 'Scooter elétrica (autopropelido)', topSpeedKmh: 32, rangeKm: 40 },
  { id: 'scooter-25', label: 'Patinete elétrico urbano', topSpeedKmh: 25, rangeKm: 30 },
  { id: 'ebike-25', label: 'Bicicleta elétrica', topSpeedKmh: 25, rangeKm: 60 },
]

export interface AvoidanceOption {
  id: AvoidanceId
  label: string
  /** Explica na própria UI de onde vem o dado — inclusive quando ele é estimado. */
  description: string
}

/**
 * As quatro opções oferecidas. Deliberadamente curtas: cada uma corresponde a
 * um dado que o pipeline realmente obtém.
 *
 * O que foi avaliado e NÃO virou opção, para não criar botão decorativo:
 * - "preferir vias urbanas mais tranquilas" já é o que o controle "Estilo de
 *   rota" (tranquil/balanced/fast) faz. Duplicar viraria dois controles
 *   disputando o mesmo ranking.
 * - "evitar trânsito pesado" exigiria dados de tráfego em tempo real, que
 *   nenhum provedor gratuito do projeto fornece.
 * - "preferir ciclovias" depende de `bicycle=designated`, cuja cobertura em
 *   Goiânia é baixa demais para sustentar a promessa; hoje essa tag já conta
 *   positivamente na classificação, sem virar promessa na interface.
 */
export const AVOIDANCE_OPTIONS: AvoidanceOption[] = [
  {
    id: 'express-roads',
    label: 'Evitar vias expressas e rodovias',
    description: 'Usa as tags reais do OSM (ref BR-, motorroad, maxspeed) já aplicadas na classificação.',
  },
  {
    id: 'unpaved',
    label: 'Evitar vias não pavimentadas',
    description: 'Detecta pela tag surface do OSM. Só marca o que está declarado — via sem a tag não é sinalizada.',
  },
  {
    id: 'steep-climbs',
    label: 'Evitar subidas íngremes',
    description: 'Inclinação acima de 6%, estimada por modelo de elevação (~90 m). Rampas curtas podem passar.',
  },
  {
    id: 'steep-descents',
    label: 'Evitar descidas íngremes',
    description: 'Mesma fonte das subidas, para quem prefere não depender de frenagem longa.',
  },
]

/**
 * Preferências cuja detecção depende do perfil de elevação.
 *
 * Existe para o pipeline saber quando a consulta de elevação vale a pena. O
 * perfil não alimenta mais nada hoje — nem pontuação, nem tela — então buscá-lo
 * com as duas opções desmarcadas é uma chamada de rede POR ROTA CANDIDATA para
 * um dado que ninguém lê. Se algum dia a elevação passar a alimentar outra
 * coisa (ETA por inclinação, autonomia real), esta é a lista a revisar.
 */
export const ELEVATION_DEPENDENT_AVOIDANCES: AvoidanceId[] = ['steep-climbs', 'steep-descents']

/**
 * Peso da preferência por veículo. A condição detectada é a mesma; o quanto
 * ela incomoda não é.
 *
 * Racional: uma subida de 6% derruba a velocidade de um patinete de roda
 * pequena muito mais do que a de uma bicicleta elétrica com assistência de
 * pedal — e piso solto é bem mais crítico para roda pequena do que para aro
 * de bicicleta. Os números são pesos relativos de produto, não medições.
 */
export const AVOIDANCE_WEIGHT_BY_VEHICLE: Record<VehicleModelId, Record<AvoidanceId, number>> = {
  'scooter-32': { 'express-roads': 1, unpaved: 1, 'steep-climbs': 1, 'steep-descents': 1 },
  'scooter-25': { 'express-roads': 1, unpaved: 1.3, 'steep-climbs': 1.2, 'steep-descents': 1.2 },
  'ebike-25': { 'express-roads': 1, unpaved: 0.7, 'steep-climbs': 0.6, 'steep-descents': 0.8 },
  custom: { 'express-roads': 1, unpaved: 1, 'steep-climbs': 1, 'steep-descents': 1 },
}

export interface UserPreferences {
  routePreference: RoutePreference
  /** Condições que o usuário pediu para evitar quando houver alternativa razoável. */
  avoidances: AvoidanceId[]
  /**
   * Voz escolhida para as instruções, pelo `voiceURI` do dispositivo. null =
   * deixar o app escolher. Nunca listamos vozes que o aparelho não tenha.
   */
  voiceUri: string | null
  theme: ThemeMode
  vehicleModelId: VehicleModelId
  /** Velocidade de referência efetiva (km/h) — usada no cálculo de ETA. */
  referenceSpeedKmh: number
  /** Autonomia estimada efetiva (km). */
  rangeKm: number
  /**
   * Velocidade em que `rangeKm` foi MEDIDO — normalmente a nominal do modelo.
   *
   * Existe porque autonomia sem velocidade de referência é um número solto. O
   * fabricante anuncia "120 km" para o veículo rodando na velocidade limitada
   * de fábrica; o mesmo veículo destravado, a 60 km/h, não faz 120 km, e a
   * diferença não é pequena — o arrasto aerodinâmico cresce com o QUADRADO da
   * velocidade.
   *
   * Guardar as duas velocidades (esta e `referenceSpeedKmh`, a que o usuário de
   * fato anda) é o que permite ao app corrigir a autonomia em vez de repetir o
   * número da caixa. Ver `speedAdjustedRangeKm`.
   */
  ratedSpeedKmh: number
  /**
   * Foto do avatar, como data URL de um JPEG já recortado em quadrado.
   *
   * Fica NO localStorage junto das demais preferências, e não num serviço de
   * arquivos, porque o app não tem backend nem conta: a foto é do aparelho,
   * como o tema e o veículo. Guardar o data URL evita depender de um
   * `blob:` que morre ao recarregar a página.
   *
   * O recorte e a redução acontecem ANTES de salvar (ver avatar.ts): uma foto
   * de celular tem vários megabytes, e o localStorage inteiro costuma ter 5.
   */
  avatarDataUrl: string | null

  /**
   * Quando a configuração inicial do veículo foi concluída. null = nunca.
   *
   * É o que decide se o app abre no onboarding. Guardar a DATA e não um
   * booleano é de propósito: no dia em que houver uma etapa nova a
   * apresentar, dá para compará-la com esta data e mostrar só a diferença,
   * em vez de reapresentar tudo a quem já configurou.
   */
  onboardingCompletedAt: number | null

  /**
   * BATERIA — o número que o usuário informou, não uma leitura.
   *
   * Estes três campos são crus de propósito; quem quiser saber a autonomia
   * AGORA deve chamar `autonomyState` (services/vehicle/autonomy.ts), que
   * aplica o decaimento por distância e a confiança pela idade. Ler
   * `batteryPercent` direto na interface é o caminho para mostrar 80% depois
   * de 30 km rodados.
   */
  batteryPercent: number | null
  batteryUpdatedAt: number | null
  /**
   * Odômetro desde a última informação de bateria.
   *
   * Cresce com o que o app REALMENTE viu o usuário percorrer em navegação —
   * não com a distância planejada das rotas, que ele pode nunca ter feito.
   * Zera toda vez que a bateria é informada de novo.
   */
  batteryDistanceSinceUpdateMeters: number

  /** Camada de adequação das vias ligada no mapa (ver MapView). Preferência de visualização, não de roteamento. */
  suitabilityLayerEnabled: boolean

  /**
   * CONSUMO OBSERVADO — o único dado real de eficiência que este app consegue
   * obter sem falar com o veículo.
   *
   * Cada amostra é um par medido: quantos metros o app VIU o usuário percorrer
   * entre duas informações de bateria, e quantos pontos percentuais caíram
   * nesse intervalo. Disso sai km por ponto percentual — para este piloto,
   * nesta moto, neste relevo.
   *
   * É melhor que a autonomia de catálogo por um motivo simples: catálogo é o
   * número do fabricante em condição ideal, e ninguém pilota em condição ideal.
   * Ver `observedRangeKm` em services/vehicle/autonomy.ts para as regras que
   * decidem quais intervalos viram amostra — a maioria não vira.
   */
  consumptionSamples: ConsumptionSample[]
}

export interface ConsumptionSample {
  /** Metros que o app efetivamente mediu no intervalo. */
  meters: number
  /** Pontos percentuais de queda no mesmo intervalo. */
  percentDrop: number
  at: number
}

const STORAGE_KEY = 'gps-scooter:preferences'

const DEFAULT_PREFERENCES: UserPreferences = {
  routePreference: 'balanced',
  avoidances: ['express-roads'],
  voiceUri: null,
  // O redesenho é um produto de tema CLARO (handoff §1): o chrome escuro
  // aparece só na navegação ativa, por tokens próprios, não pelo tema. O
  // seletor de tema continua existindo como preferência do usuário.
  theme: 'light',
  vehicleModelId: 'scooter-32',
  referenceSpeedKmh: 32,
  rangeKm: 40,
  ratedSpeedKmh: 32,
  avatarDataUrl: null,
  onboardingCompletedAt: null,
  batteryPercent: null,
  batteryUpdatedAt: null,
  batteryDistanceSinceUpdateMeters: 0,
  suitabilityLayerEnabled: false,
  consumptionSamples: [],
}

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

/**
 * Rótulo do veículo ativo. Fonte única de verdade para a UI: quando o usuário
 * escolhe outro modelo no Perfil, TODAS as telas passam a mostrar este valor.
 *
 * `custom` aparece quando velocidade/autonomia foram ajustadas à mão, saindo
 * de qualquer preset — nesse caso o rótulo descreve o que foi configurado em
 * vez de mentir dizendo que ainda é um dos modelos prontos.
 */
export function resolveVehicleLabel(preferences: UserPreferences): string {
  const preset = VEHICLE_PRESETS.find((entry) => entry.id === preferences.vehicleModelId)
  if (preset) return preset.label
  return `Veículo personalizado · ${preferences.referenceSpeedKmh} km/h`
}
