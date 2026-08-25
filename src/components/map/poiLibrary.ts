/**
 * Biblioteca visual de POIs (pacote `poi_assets_gps`, Claude Design).
 *
 * ESTE ARQUIVO É O ÚNICO MAPEAMENTO. Nada de decidir ícone espalhado pelo
 * código: quem quiser trocar um asset, corrigir uma equivalência ou abrir uma
 * categoria nova mexe aqui e em nenhum outro lugar. `poiIcons.ts` só executa o
 * que está descrito abaixo.
 *
 * O pacote traz 20 categorias em três variantes:
 *
 *   badge/  96×96  — estado padrão sobre o mapa (30–36px, 40px quando o rótulo aparece)
 *   dot/    32×32  — zoom baixo e alta densidade (16–22px)
 *   pin/    96×100 — POI selecionado / destino (âncora na ponta)
 *
 * As três compartilham forma (squircle), anel branco a 94%, sombra e símbolo
 * monoline a 60% do badge. É o anel + a sombra que garantem leitura nos DOIS
 * temas — por isso não existe versão clara e versão escura, e por isso os
 * ícones são registrados UMA vez e não se re-rasterizam na troca de tema.
 *
 * `pin/` está copiado em `public/poi/pin` e catalogado aqui, mas ainda NÃO é
 * usado: origem e destino do app têm marcadores próprios, e trocá-los estava
 * fora do escopo desta implementação.
 */

/** Slug da categoria = nome do arquivo, sem o sufixo da variante. */
export type PoiCategory =
  | 'poi_alimentacao'
  | 'poi_cafes'
  | 'poi_mercado'
  | 'poi_compras'
  | 'poi_saude'
  | 'poi_farmacia'
  | 'poi_bem_estar'
  | 'poi_transporte'
  | 'poi_recarga'
  | 'poi_combustivel'
  | 'poi_estacionamento'
  | 'poi_hospedagem'
  | 'poi_lazer'
  | 'poi_turismo'
  | 'poi_parques'
  | 'poi_educacao'
  | 'poi_servicos'
  | 'poi_financeiro'
  | 'poi_ciclismo'
  | 'poi_generico'

/** Categoria usada quando a `class` do provedor não tem equivalência. Nunca esconder o POI. */
export const POI_FALLBACK: PoiCategory = 'poi_generico'

export const POI_CATEGORIES: PoiCategory[] = [
  'poi_alimentacao',
  'poi_cafes',
  'poi_mercado',
  'poi_compras',
  'poi_saude',
  'poi_farmacia',
  'poi_bem_estar',
  'poi_transporte',
  'poi_recarga',
  'poi_combustivel',
  'poi_estacionamento',
  'poi_hospedagem',
  'poi_lazer',
  'poi_turismo',
  'poi_parques',
  'poi_educacao',
  'poi_servicos',
  'poi_financeiro',
  'poi_ciclismo',
  'poi_generico',
]

/**
 * `class` do MapTiler → categoria da biblioteca.
 *
 * As chaves NÃO foram inventadas nem copiadas só do README do pacote: são as
 * classes que as onze camadas de POI do estilo `streets-v2` realmente filtram,
 * lidas do estilo em execução. Onde o README e o estilo divergem, vale o
 * estilo — é ele que decide quais feições existem.
 *
 * Algumas equivalências que não são óbvias e foram decididas aqui:
 *
 * - `chemist` é drogaria no vocabulário do OSM, então vai para farmácia e não
 *   para compras.
 * - As classes esportivas (quadra, estádio, ginásio) vão para LAZER, não para
 *   bem-estar: bem-estar ficou com o que é cuidado pessoal (salão, sauna,
 *   academia, piscina). `playground` vai para parques, como o pacote pede.
 * - `cemetery` vai para parques por ser área verde; não há categoria melhor e
 *   mandá-lo para genérico apagaria a informação de que ali não se atravessa.
 * - `car`, `car_rental` e `car_repair` vão para serviços: são irrelevantes
 *   para veículo leve, e a cor sóbria da categoria diz exatamente isso.
 * - `bicycle`, `bicycle_rental` e `scooter` vão para CICLISMO, que é a
 *   categoria mais relevante deste produto depois de recarga.
 */
export const POI_CLASS_MAP: Record<string, PoiCategory> = {
  // — Alimentação
  restaurant: 'poi_alimentacao',
  fast_food: 'poi_alimentacao',
  food_court: 'poi_alimentacao',
  bbq: 'poi_alimentacao',

  // — Cafés, bares e padarias
  cafe: 'poi_cafes',
  bar: 'poi_cafes',
  beer: 'poi_cafes',
  biergarten: 'poi_cafes',
  pub: 'poi_cafes',
  ice_cream: 'poi_cafes',
  bakery: 'poi_cafes',

  // — Mercado e conveniência
  grocery: 'poi_mercado',
  supermarket: 'poi_mercado',
  convenience: 'poi_mercado',
  butcher: 'poi_mercado',
  alcohol_shop: 'poi_mercado',

  // — Compras
  shop: 'poi_compras',
  mall: 'poi_compras',
  clothing_store: 'poi_compras',
  gift: 'poi_compras',
  book: 'poi_compras',
  books: 'poi_compras',
  music: 'poi_compras',

  // — Saúde
  hospital: 'poi_saude',
  clinic: 'poi_saude',
  doctors: 'poi_saude',
  dentist: 'poi_saude',
  first_aid: 'poi_saude',
  veterinary: 'poi_saude',

  // — Farmácia
  pharmacy: 'poi_farmacia',
  chemist: 'poi_farmacia',

  // — Bem-estar
  hairdresser: 'poi_bem_estar',
  sauna: 'poi_bem_estar',
  fitness: 'poi_bem_estar',
  fitness_centre: 'poi_bem_estar',
  swimming: 'poi_bem_estar',
  swimming_pool: 'poi_bem_estar',
  swimming_area: 'poi_bem_estar',

  // — Transporte
  terminal: 'poi_transporte',
  bus: 'poi_transporte',
  railway: 'poi_transporte',
  ferry_terminal: 'poi_transporte',
  harbor: 'poi_transporte',
  heliport: 'poi_transporte',

  // — Recarga elétrica
  charging_station: 'poi_recarga',

  // — Combustível
  fuel: 'poi_combustivel',

  // — Estacionamento
  parking: 'poi_estacionamento',
  parking_garage: 'poi_estacionamento',
  parking_paid: 'poi_estacionamento',
  bicycle_parking: 'poi_estacionamento',
  motorcycle_parking: 'poi_estacionamento',

  // — Hospedagem
  hotel: 'poi_hospedagem',
  lodging: 'poi_hospedagem',
  hostel: 'poi_hospedagem',
  motel: 'poi_hospedagem',
  guest_house: 'poi_hospedagem',
  apartment: 'poi_hospedagem',
  chalet: 'poi_hospedagem',
  campsite: 'poi_hospedagem',
  camp_site: 'poi_hospedagem',
  caravan_site: 'poi_hospedagem',

  // — Lazer e entretenimento
  cinema: 'poi_lazer',
  theatre: 'poi_lazer',
  opera: 'poi_lazer',
  planetarium: 'poi_lazer',
  theme_park: 'poi_lazer',
  water_park: 'poi_lazer',
  zoo: 'poi_lazer',
  aquarium: 'poi_lazer',
  stadium: 'poi_lazer',
  sports_centre: 'poi_lazer',
  sports_hall: 'poi_lazer',
  sport: 'poi_lazer',
  pitch: 'poi_lazer',
  soccer: 'poi_lazer',
  basketball: 'poi_lazer',
  volleyball: 'poi_lazer',
  tennis: 'poi_lazer',
  baseball: 'poi_lazer',
  american_football: 'poi_lazer',
  athletics: 'poi_lazer',
  archery: 'poi_lazer',
  climbing: 'poi_lazer',
  equestrian: 'poi_lazer',
  golf: 'poi_lazer',
  motor: 'poi_lazer',
  multi: 'poi_lazer',
  running: 'poi_lazer',

  // — Turismo
  attraction: 'poi_turismo',
  museum: 'poi_turismo',
  monument: 'poi_turismo',
  castle: 'poi_turismo',
  ruins: 'poi_turismo',
  archeological_site: 'poi_turismo',
  art_gallery: 'poi_turismo',
  gallery: 'poi_turismo',
  information: 'poi_turismo',
  place_of_worship: 'poi_turismo',
  monastery: 'poi_turismo',

  // — Parques e áreas verdes
  park: 'poi_parques',
  playground: 'poi_parques',
  cemetery: 'poi_parques',

  // — Educação
  school: 'poi_educacao',
  college: 'poi_educacao',
  university: 'poi_educacao',
  kindergarten: 'poi_educacao',
  childcare: 'poi_educacao',
  dancing_school: 'poi_educacao',
  driving_school: 'poi_educacao',
  library: 'poi_educacao',

  // — Serviços
  office: 'poi_servicos',
  car_repair: 'poi_servicos',
  car: 'poi_servicos',
  car_rental: 'poi_servicos',
  laundry: 'poi_servicos',
  post: 'poi_servicos',
  recycling: 'poi_servicos',
  toll: 'poi_servicos',
  highway_rest_area: 'poi_servicos',
  community_centre: 'poi_servicos',
  courthouse: 'poi_servicos',
  townhall: 'poi_servicos',
  town_hall: 'poi_servicos',
  fire_station: 'poi_servicos',
  prison: 'poi_servicos',
  telephone: 'poi_servicos',
  toilets: 'poi_servicos',
  shower: 'poi_servicos',
  drinking_water: 'poi_servicos',
  fountain: 'poi_servicos',

  // — Financeiro
  bank: 'poi_financeiro',
  atm: 'poi_financeiro',

  // — Ciclismo e mobilidade leve
  bicycle: 'poi_ciclismo',
  bicycle_rental: 'poi_ciclismo',
  scooter: 'poi_ciclismo',

  // — Sem equivalência: represa/açude não é estabelecimento e não tem
  // categoria própria no pacote. Explícito aqui, e não deixado para o
  // fallback, para a próxima pessoa saber que foi decidido e não esquecido.
  reservoir: 'poi_generico',
}

/**
 * Toda `class` que as camadas de POI do estilo filtram está mapeada acima —
 * conferido contra os filtros lidos do estilo em execução, não contra o README
 * do pacote. Se o MapTiler introduzir uma classe nova, ela cai em
 * `POI_FALLBACK` e continua aparecendo no mapa.
 */

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

export const POI_ASSET_BASE = '/poi'

/**
 * Tamanhos de registro, em px CSS do ARQUIVO INTEIRO.
 *
 * Cuidado com a diferença entre o arquivo e o desenho: no badge o squircle
 * ocupa 64 das 96 unidades do viewBox (o resto é folga para a sombra), então
 * registrar a 60px produz um badge de ~40px — que é o tamanho de destaque que
 * o pacote pede. No dot o disco tem raio 11 em 32, ou seja 22 de 32: registrar
 * a 32px dá um ponto de 22px, topo da faixa 16–22px do pacote.
 *
 * Sem essa conta, "registrar a 36px porque o pacote fala em 30–36px" daria um
 * badge de 24px, um terço menor que o projetado.
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

/** Ainda não usado — ver nota no topo do arquivo. */
export function pinUrl(category: PoiCategory): string {
  return `${POI_ASSET_BASE}/pin/${category}_pin.svg`
}

/** Id da imagem registrada no mapa, por variante. */
export function poiImageId(category: PoiCategory, variant: 'badge' | 'dot'): string {
  return `gps-${variant}-${category}`
}
