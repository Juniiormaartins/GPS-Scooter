/**
 * Biblioteca visual de POIs + marcador de destino (pacote `poi_destino_assets_v2`,
 * Claude Design).
 *
 * ESTE ARQUIVO É O ÚNICO MAPEAMENTO. Trocar um asset, corrigir uma
 * equivalência ou abrir uma categoria nova acontece aqui e em nenhum outro
 * lugar; `poiIcons.ts` apenas executa o que está descrito abaixo.
 *
 * 58 categorias em 21 FAMÍLIAS DE COR. Subcategorias compartilham exatamente a
 * cor da família e se diferenciam só pelo glifo — pizzaria, lanchonete e
 * restaurante são o mesmo laranja. É isso que faz 58 ícones conviverem no mesmo
 * enquadramento sem virar mosaico: lê-se primeiro a COR (que tipo de coisa é) e
 * depois o SÍMBOLO (o que exatamente é).
 *
 * Variantes por contexto:
 *   badge/  96×96  — padrão sobre o mapa (30–36px; 40px com rótulo)
 *   dot/    32×32  — zoom baixo, alta densidade e navegação ativa (14–22px)
 *   pin/    96×100 — selecionado / resultado de busca (âncora na ponta)
 *   destino/       — marcador do destino, ver DESTINATION_ASSETS
 *
 * Os dois temas usam o MESMO asset: o anel branco a 94% e a sombra própria
 * resolvem leitura sobre mapa claro e escuro, sem depender da cor do fundo.
 */

/** Slug da categoria = nome do arquivo, sem o sufixo da variante. */
export type PoiCategory =
  | 'poi_alimentacao'
  | 'poi_lanchonete'
  | 'poi_pizzaria'
  | 'poi_cafes'
  | 'poi_padaria'
  | 'poi_sorveteria'
  | 'poi_bar'
  | 'poi_mercado'
  | 'poi_hortifruti'
  | 'poi_feira'
  | 'poi_compras'
  | 'poi_loja_roupas'
  | 'poi_eletronicos'
  | 'poi_floricultura'
  | 'poi_saude'
  | 'poi_clinica'
  | 'poi_odontologia'
  | 'poi_laboratorio'
  | 'poi_veterinario'
  | 'poi_farmacia'
  | 'poi_bem_estar'
  | 'poi_salao_beleza'
  | 'poi_academia'
  | 'poi_esportes'
  | 'poi_transporte'
  | 'poi_onibus'
  | 'poi_metro'
  | 'poi_aeroporto'
  | 'poi_taxi'
  | 'poi_recarga'
  | 'poi_combustivel'
  | 'poi_oficina'
  | 'poi_estacionamento'
  | 'poi_hospedagem'
  | 'poi_lazer'
  | 'poi_cinema'
  | 'poi_teatro'
  | 'poi_estadio'
  | 'poi_parques'
  | 'poi_turismo'
  | 'poi_museu'
  | 'poi_igreja'
  | 'poi_livraria'
  | 'poi_mirante'
  | 'poi_educacao'
  | 'poi_servicos'
  | 'poi_escritorio'
  | 'poi_correios'
  | 'poi_lavanderia'
  | 'poi_materiais'
  | 'poi_imobiliaria'
  | 'poi_policia'
  | 'poi_bombeiros'
  | 'poi_servico_publico'
  | 'poi_financeiro'
  | 'poi_caixa_eletronico'
  | 'poi_ciclismo'
  | 'poi_generico'

/**
 * Categoria usada quando a classe do provedor não tem equivalência.
 *
 * REGRA OBRIGATÓRIA DO PACOTE, implementada em `poiCategoryForClass`: nunca
 * ocultar um POI por falta de mapeamento, nunca inventar uma categoria
 * aproximada. Classe desconhecida, `class` nula ou POI sem categoria →
 * `poi_generico`, que é membro oficial da biblioteca (mesma anatomia, cinza-
 * azulado neutro) e não um ícone de descarte.
 */
export const POI_FALLBACK: PoiCategory = 'poi_generico'

export const POI_CATEGORIES: PoiCategory[] = [
  'poi_alimentacao',
  'poi_lanchonete',
  'poi_pizzaria',
  'poi_cafes',
  'poi_padaria',
  'poi_sorveteria',
  'poi_bar',
  'poi_mercado',
  'poi_hortifruti',
  'poi_feira',
  'poi_compras',
  'poi_loja_roupas',
  'poi_eletronicos',
  'poi_floricultura',
  'poi_saude',
  'poi_clinica',
  'poi_odontologia',
  'poi_laboratorio',
  'poi_veterinario',
  'poi_farmacia',
  'poi_bem_estar',
  'poi_salao_beleza',
  'poi_academia',
  'poi_esportes',
  'poi_transporte',
  'poi_onibus',
  'poi_metro',
  'poi_aeroporto',
  'poi_taxi',
  'poi_recarga',
  'poi_combustivel',
  'poi_oficina',
  'poi_estacionamento',
  'poi_hospedagem',
  'poi_lazer',
  'poi_cinema',
  'poi_teatro',
  'poi_estadio',
  'poi_parques',
  'poi_turismo',
  'poi_museu',
  'poi_igreja',
  'poi_livraria',
  'poi_mirante',
  'poi_educacao',
  'poi_servicos',
  'poi_escritorio',
  'poi_correios',
  'poi_lavanderia',
  'poi_materiais',
  'poi_imobiliaria',
  'poi_policia',
  'poi_bombeiros',
  'poi_servico_publico',
  'poi_financeiro',
  'poi_caixa_eletronico',
  'poi_ciclismo',
  'poi_generico',
]

/**
 * `class` do provedor → categoria da biblioteca.
 *
 * DUAS ORIGENS, e a distinção importa:
 *
 * 1. A TABELA DO PACOTE (README do `poi_destino_assets_v2`), que é a fonte
 *    canônica das equivalências;
 * 2. Uma EXTENSÃO para as classes que o estilo `streets-v2` do MapTiler
 *    realmente emite e que a tabela não lista. Foram 65 delas — `sport`,
 *    `soccer`, `art_gallery`, `alcohol_shop`, `cemetery`, `town_hall`… Segui-
 *    las para o genérico seria obedecer a regra de fallback ao pé da letra e
 *    errar o espírito dela: a biblioteca TEM categoria específica para
 *    praticamente todas, e o fallback existe para o que não tem, não para o
 *    que a tabela não previu.
 *
 * As classes reais foram lidas dos filtros do estilo em execução, não supostas.
 * Conferido: nenhuma classe aparece em duas categorias.
 */
export const POI_CLASS_MAP: Record<string, PoiCategory> = {
  // — Alimentação
  bbq: 'poi_alimentacao',
  food_and_drink: 'poi_alimentacao',
  food_court: 'poi_alimentacao',
  restaurant: 'poi_alimentacao',
  burger: 'poi_lanchonete',
  fast_food: 'poi_lanchonete',
  snack_bar: 'poi_lanchonete',
  pizza: 'poi_pizzaria',

  // — Cafés, padaria e bar
  cafe: 'poi_cafes',
  coffee: 'poi_cafes',
  tea: 'poi_cafes',
  bakery: 'poi_padaria',
  pastry: 'poi_padaria',
  confectionery: 'poi_sorveteria',
  dessert: 'poi_sorveteria',
  ice_cream: 'poi_sorveteria',
  alcohol: 'poi_bar',
  alcohol_shop: 'poi_bar',
  bar: 'poi_bar',
  beer: 'poi_bar',
  biergarten: 'poi_bar',
  nightclub: 'poi_bar',
  pub: 'poi_bar',

  // — Mercado
  convenience: 'poi_mercado',
  grocery: 'poi_mercado',
  supermarket: 'poi_mercado',
  butcher: 'poi_hortifruti',
  deli: 'poi_hortifruti',
  farm: 'poi_hortifruti',
  greengrocer: 'poi_hortifruti',
  marketplace: 'poi_feira',
  street_market: 'poi_feira',

  // — Compras
  commercial: 'poi_compras',
  department_store: 'poi_compras',
  mall: 'poi_compras',
  music: 'poi_compras',
  shop: 'poi_compras',
  shopping: 'poi_compras',
  clothes: 'poi_loja_roupas',
  clothing_store: 'poi_loja_roupas',
  jewelry: 'poi_loja_roupas',
  shoes: 'poi_loja_roupas',
  computer: 'poi_eletronicos',
  electronics: 'poi_eletronicos',
  mobile_phone: 'poi_eletronicos',
  florist: 'poi_floricultura',
  gift: 'poi_floricultura',

  // — Saúde
  emergency_room: 'poi_saude',
  first_aid: 'poi_saude',
  health: 'poi_saude',
  hospital: 'poi_saude',
  clinic: 'poi_clinica',
  doctors: 'poi_clinica',
  physiotherapist: 'poi_clinica',
  dentist: 'poi_odontologia',
  blood_donation: 'poi_laboratorio',
  laboratory: 'poi_laboratorio',
  medical_laboratory: 'poi_laboratorio',
  pet: 'poi_veterinario',
  pet_shop: 'poi_veterinario',
  veterinary: 'poi_veterinario',

  // — Farmácia
  chemist: 'poi_farmacia',
  pharmacy: 'poi_farmacia',

  // — Bem-estar e esporte
  beauty: 'poi_bem_estar',
  care: 'poi_bem_estar',
  massage: 'poi_bem_estar',
  sauna: 'poi_bem_estar',
  spa: 'poi_bem_estar',
  barber: 'poi_salao_beleza',
  hairdresser: 'poi_salao_beleza',
  nail_salon: 'poi_salao_beleza',
  fitness: 'poi_academia',
  fitness_centre: 'poi_academia',
  gym: 'poi_academia',
  american_football: 'poi_esportes',
  archery: 'poi_esportes',
  athletics: 'poi_esportes',
  baseball: 'poi_esportes',
  basketball: 'poi_esportes',
  climbing: 'poi_esportes',
  equestrian: 'poi_esportes',
  golf: 'poi_esportes',
  motor: 'poi_esportes',
  multi: 'poi_esportes',
  pitch: 'poi_esportes',
  running: 'poi_esportes',
  soccer: 'poi_esportes',
  sport: 'poi_esportes',
  sports: 'poi_esportes',
  sports_centre: 'poi_esportes',
  sports_hall: 'poi_esportes',
  swimming: 'poi_esportes',
  swimming_area: 'poi_esportes',
  swimming_pool: 'poi_esportes',
  tennis: 'poi_esportes',
  volleyball: 'poi_esportes',

  // — Transporte
  ferry_terminal: 'poi_transporte',
  harbor: 'poi_transporte',
  heliport: 'poi_transporte',
  public_transport: 'poi_transporte',
  station: 'poi_transporte',
  terminal: 'poi_transporte',
  transport: 'poi_transporte',
  bus: 'poi_onibus',
  bus_station: 'poi_onibus',
  bus_stop: 'poi_onibus',
  railway: 'poi_metro',
  subway: 'poi_metro',
  train_station: 'poi_metro',
  tram: 'poi_metro',
  aerodrome: 'poi_aeroporto',
  airfield: 'poi_aeroporto',
  airport: 'poi_aeroporto',
  ride_hailing: 'poi_taxi',
  taxi: 'poi_taxi',

  // — Recarga elétrica
  charging_station: 'poi_recarga',

  // — Automotivo
  fuel: 'poi_combustivel',
  gas: 'poi_combustivel',
  car: 'poi_oficina',
  car_parts: 'poi_oficina',
  car_rental: 'poi_oficina',
  car_repair: 'poi_oficina',
  car_wash: 'poi_oficina',
  tyres: 'poi_oficina',

  // — Estacionamento
  bicycle_parking: 'poi_estacionamento',
  motorcycle_parking: 'poi_estacionamento',
  parking: 'poi_estacionamento',
  parking_garage: 'poi_estacionamento',
  parking_paid: 'poi_estacionamento',

  // — Hospedagem
  apartment: 'poi_hospedagem',
  camp_site: 'poi_hospedagem',
  campsite: 'poi_hospedagem',
  caravan_site: 'poi_hospedagem',
  chalet: 'poi_hospedagem',
  guest_house: 'poi_hospedagem',
  hostel: 'poi_hospedagem',
  hotel: 'poi_hospedagem',
  lodging: 'poi_hospedagem',
  motel: 'poi_hospedagem',

  // — Lazer e entretenimento
  amusement: 'poi_lazer',
  aquarium: 'poi_lazer',
  bowling: 'poi_lazer',
  entertainment: 'poi_lazer',
  nightlife: 'poi_lazer',
  theme_park: 'poi_lazer',
  water_park: 'poi_lazer',
  zoo: 'poi_lazer',
  cinema: 'poi_cinema',
  movie_theater: 'poi_cinema',
  arts_centre: 'poi_teatro',
  concert_hall: 'poi_teatro',
  opera: 'poi_teatro',
  theatre: 'poi_teatro',
  arena: 'poi_estadio',
  stadium: 'poi_estadio',

  // — Áreas verdes
  cemetery: 'poi_parques',
  garden: 'poi_parques',
  park: 'poi_parques',
  pitch_green: 'poi_parques',
  playground: 'poi_parques',
  square: 'poi_parques',

  // — Cultura e turismo
  archeological_site: 'poi_turismo',
  attraction: 'poi_turismo',
  castle: 'poi_turismo',
  information: 'poi_turismo',
  memorial: 'poi_turismo',
  monastery: 'poi_turismo',
  monument: 'poi_turismo',
  ruins: 'poi_turismo',
  tourism: 'poi_turismo',
  art_gallery: 'poi_museu',
  gallery: 'poi_museu',
  museum: 'poi_museu',
  planetarium: 'poi_museu',
  church: 'poi_igreja',
  mosque: 'poi_igreja',
  place_of_worship: 'poi_igreja',
  synagogue: 'poi_igreja',
  temple: 'poi_igreja',
  book: 'poi_livraria',
  books: 'poi_livraria',
  library: 'poi_livraria',
  lookout: 'poi_mirante',
  viewpoint: 'poi_mirante',

  // — Educação
  childcare: 'poi_educacao',
  college: 'poi_educacao',
  dancing_school: 'poi_educacao',
  driving_school: 'poi_educacao',
  education: 'poi_educacao',
  kindergarten: 'poi_educacao',
  school: 'poi_educacao',
  university: 'poi_educacao',

  // — Serviços
  commercial_service: 'poi_servicos',
  craft: 'poi_servicos',
  highway_rest_area: 'poi_servicos',
  repair: 'poi_servicos',
  service: 'poi_servicos',
  toll: 'poi_servicos',
  company: 'poi_escritorio',
  coworking: 'poi_escritorio',
  office: 'poi_escritorio',
  parcel_locker: 'poi_correios',
  post: 'poi_correios',
  post_office: 'poi_correios',
  dry_cleaning: 'poi_lavanderia',
  laundry: 'poi_lavanderia',
  building_materials: 'poi_materiais',
  doityourself: 'poi_materiais',
  hardware: 'poi_materiais',
  estate_agent: 'poi_imobiliaria',
  real_estate: 'poi_imobiliaria',

  // — Segurança e serviços públicos
  police: 'poi_policia',
  security: 'poi_policia',
  emergency: 'poi_bombeiros',
  fire_station: 'poi_bombeiros',
  community_centre: 'poi_servico_publico',
  courthouse: 'poi_servico_publico',
  drinking_water: 'poi_servico_publico',
  embassy: 'poi_servico_publico',
  fountain: 'poi_servico_publico',
  government: 'poi_servico_publico',
  prison: 'poi_servico_publico',
  public_building: 'poi_servico_publico',
  recycling: 'poi_servico_publico',
  shower: 'poi_servico_publico',
  telephone: 'poi_servico_publico',
  toilets: 'poi_servico_publico',
  town_hall: 'poi_servico_publico',
  townhall: 'poi_servico_publico',

  // — Financeiro
  bank: 'poi_financeiro',
  bureau_de_change: 'poi_financeiro',
  finance: 'poi_financeiro',
  insurance: 'poi_financeiro',
  atm: 'poi_caixa_eletronico',

  // — Mobilidade leve
  bicycle: 'poi_ciclismo',
  bicycle_rental: 'poi_ciclismo',
  bicycle_shop: 'poi_ciclismo',
  scooter: 'poi_ciclismo',

  // — Genérico (fallback)
  class: 'poi_generico',
  reservoir: 'poi_generico',

}
/**
 * Camadas de POI do estilo `streets-v2`, lidas do estilo em execução.
 *
 * São as ÚNICAS camadas tocadas. `Place labels` fica de fora de propósito: ela
 * vem da fonte `place` (bairro, distrito), não é ponto de interesse e não tem
 * ícone.
 */
export const POI_LAYER_IDS = [
  'Food',
  'Shopping',
  'Healthcare',
  'Transport',
  'Station',
  'Culture',
  'Education',
  'Tourism',
  'Sport',
  'Park',
  'Public',
] as const

/**
 * A REGRA DE FALLBACK, num lugar só.
 *
 * Existe como função — e não como um `??` espalhado por quem consulta o mapa —
 * porque o pacote a define como obrigatória e ela precisa valer igual em todo
 * caminho: camada do mapa, resultado de busca, ficha do local. Aqui também
 * cabe a normalização (`class` vem com caixa e espaços irregulares de
 * provedores diferentes) e a tentativa por `subclass`, que o README menciona.
 *
 * Nunca devolve null: uma classe desconhecida vira `poi_generico`, nunca
 * "nenhum ícone".
 */
export function poiCategoryForClass(className?: string | null, subclass?: string | null): PoiCategory {
  const direct = lookup(className)
  if (direct) return direct
  // `subclass` costuma ser mais específico que `class` (ex: class=shop,
  // subclass=florist). Só é consultado quando a classe não resolveu, para não
  // sobrepor uma equivalência canônica da tabela.
  const bySubclass = lookup(subclass)
  if (bySubclass) return bySubclass
  return POI_FALLBACK
}

function lookup(value?: string | null): PoiCategory | null {
  if (!value) return null
  return POI_CLASS_MAP[value.trim().toLowerCase()] ?? null
}

export const POI_ASSET_BASE = '/poi'

/**
 * Tamanhos de registro, em px CSS do ARQUIVO INTEIRO.
 *
 * Cuidado com a diferença entre o arquivo e o desenho: no badge o squircle
 * ocupa 64 das 96 unidades do viewBox (o resto é folga para a sombra), então
 * registrar a 60px produz um badge de ~40px — o tamanho de destaque que o
 * pacote pede. No dot o disco tem raio 11 em 32: registrar a 32px dá um ponto
 * de 22px, topo da faixa 16–22px.
 */
export const BADGE_FILE_PX = 60
export const DOT_FILE_PX = 32

/** Zoom em que o `dot` dá lugar ao `badge`. Abaixo disso a densidade é alta demais para o badge. */
export const BADGE_MIN_ZOOM = 15

export function badgeUrl(category: PoiCategory): string {
  return `${POI_ASSET_BASE}/badge/${category}.svg`
}

export function dotUrl(category: PoiCategory): string {
  return `${POI_ASSET_BASE}/dot/${category}_dot.svg`
}

/** Variante selecionada — âncora na ponta. Ainda não usada pelas camadas do mapa. */
export function pinUrl(category: PoiCategory): string {
  return `${POI_ASSET_BASE}/pin/${category}_pin.svg`
}

/** Id da imagem registrada no mapa, por variante. */
export function poiImageId(category: PoiCategory, variant: 'badge' | 'dot'): string {
  return `gps-${variant}-${category}`
}

/**
 * MARCADOR DE DESTINO.
 *
 * Reusa a silhueta da família de POIs — por isso pertence ao mesmo sistema —
 * mas com corpo azul-marinho e alvo ciano no lugar do glifo. O marinho é
 * deliberado: a rota é `#0E86C6`, e um marcador azul-claro se dissolveria no
 * traçado.
 *
 * A ORDEM DE CAMADAS importa e está implementada em MapView: rota → tampa de
 * chegada → halo → marcador. A tampa entra ACIMA da rota e ABAIXO do marcador,
 * e é ela que impede a leitura de "linha azul passando por baixo de uma
 * bolinha".
 */
export const DESTINATION_ASSETS = {
  /** Estado padrão (96×100). Âncora na ponta inferior. */
  marker: `${POI_ASSET_BASE}/destino/destino_marcador.svg`,
  /** Destino em foco: halo e anel pulsante (200×200). Âncora na base do halo. */
  markerActive: `${POI_ASSET_BASE}/destino/destino_marcador_ativo.svg`,
  /** Tampa onde o traçado termina (72×72). Âncora no centro. */
  routeCap: `${POI_ASSET_BASE}/destino/destino_chegada_rota.svg`,
  /**
   * Halo e sombra isolados (200×100).
   *
   * NÃO USADO, e de propósito: o pacote o oferece para quem quiser compor o
   * halo por conta própria, mas `markerActive` já traz halo e anel pulsante
   * no mesmo arquivo. Usar os dois empilharia dois halos. Fica catalogado
   * porque é a peça a usar se o estado ativo um dia precisar do halo separado
   * do pino — por exemplo, para animá-los em ritmos diferentes.
   */
  base: `${POI_ASSET_BASE}/destino/destino_base.svg`,
  /** Versão compacta para zoom baixo (40×40). */
  dot: `${POI_ASSET_BASE}/destino/destino_dot.svg`,
} as const

/** Tamanhos em tela do conjunto de destino, conforme o pacote. */
export const DESTINATION_SIZES = {
  markerPx: 56,
  routeCapPx: 34,
  dotPx: 26,
  /** Abaixo deste zoom, só a tampa e o ponto compacto — o pino não cabe. */
  compactBelowZoom: 14,
} as const
