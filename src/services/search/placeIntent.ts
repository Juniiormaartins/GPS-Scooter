/**
 * INTENÇÃO DE BUSCA — "farmácia" não é o nome de um lugar, é um TIPO de lugar.
 *
 * O PROBLEMA, medido. Das 33 farmácias num raio de 3 km da Praça Cívica, só UMA
 * tem "farm" no nome. As outras 32 — Pague Menos a 235 m, Droga Raia a 265 m,
 * Drogasil a 304 m — se chamam "Droga…" ou levam o nome da rede. Como a busca
 * casava o texto digitado com o NOME, quem digitava "farmácia" via as poucas
 * que levam a palavra no nome, a quilômetros de distância, e nunca as que
 * estavam na esquina.
 *
 * O QUE ESTE MÓDULO FAZ. Reconhece quando o texto digitado é um tipo de lugar
 * (e não um nome) e diz QUAIS TAGS do OpenStreetMap descrevem esse tipo. Com
 * isso a busca passa a perguntar "me dê as farmácias perto de mim" — por
 * categoria —, em vez de "me dê lugares cujo nome contém farmácia".
 *
 * É PURO: texto entra, descrição da intenção sai. Sem rede, sem estado.
 */

export interface PlaceIntent {
  id: string
  /** Rótulo curto em pt-BR, usado como subtítulo do resultado ("Farmácia"). */
  label: string
  /** Filtros de tag para o Overpass — cada item vira um `nwr[...]` (o resultado é a união). */
  overpass: string[]
  /**
   * Nome alternativo, em regex, para quando o OSM não etiquetou a categoria
   * mas o nome denuncia (siglas: "UPA", "CAIS"). Combinado com `nameTags`.
   */
  nameAlt?: string
  /** Valores de `amenity|healthcare` que, junto de `nameAlt`, contam como o lugar procurado. */
  nameTags?: string
  /** Pares `class:type` do Nominatim que são essa categoria — o resto é ruído (um banco de praça NÃO é um banco). */
  nominatim: string[]
  /** Termos que disparam a intenção, já sem acento e em minúsculas. */
  terms: string[]
  /** Raio da busca por categoria, em metros. Categorias raras (UPA) precisam de mais. */
  radiusM: number
}

export const INTENTS: PlaceIntent[] = [
  {
    id: 'pharmacy',
    label: 'Farmácia',
    overpass: ['"amenity"="pharmacy"'],
    nominatim: ['amenity:pharmacy', 'shop:chemist'],
    terms: ['farmacia', 'drogaria', 'droga', 'remedio', 'remedios'],
    radiusM: 3000,
  },
  {
    id: 'urgent-care',
    label: 'Pronto atendimento',
    overpass: ['"amenity"~"^(hospital|clinic|doctors)$"]["emergency"="yes"'],
    nameAlt: '(^|[^A-Za-z])(UPA|CAIS|CIAMS)([^A-Za-z]|$)|Pronto[ -]Atendimento|Pronto[ -]Socorro',
    nameTags: 'hospital|clinic|doctors',
    nominatim: ['amenity:hospital', 'amenity:clinic', 'amenity:doctors', 'healthcare:hospital', 'healthcare:clinic'],
    terms: ['upa', 'pronto atendimento', 'pronto socorro', 'emergencia', 'urgencia', 'cais'],
    // Poucas e longe do centro: 8 km deixava a mais próxima de fora.
    radiusM: 15000,
  },
  {
    id: 'hospital',
    label: 'Hospital',
    overpass: ['"amenity"="hospital"'],
    nominatim: ['amenity:hospital', 'healthcare:hospital'],
    terms: ['hospital', 'hospitais'],
    radiusM: 6000,
  },
  {
    id: 'clinic',
    label: 'Clínica',
    overpass: ['"amenity"~"^(clinic|doctors)$"'],
    nominatim: ['amenity:clinic', 'amenity:doctors', 'healthcare:clinic', 'healthcare:doctor'],
    terms: ['clinica', 'consultorio', 'medico', 'laboratorio'],
    radiusM: 4000,
  },
  {
    id: 'fuel',
    label: 'Posto de combustível',
    overpass: ['"amenity"="fuel"'],
    nominatim: ['amenity:fuel'],
    terms: ['posto', 'combustivel', 'gasolina', 'abastecer', 'abastecimento'],
    radiusM: 4000,
  },
  {
    id: 'supermarket',
    label: 'Supermercado',
    overpass: ['"shop"~"^(supermarket|convenience)$"'],
    nominatim: ['shop:supermarket', 'shop:convenience', 'amenity:marketplace'],
    terms: ['mercado', 'supermercado', 'mercadinho', 'atacado', 'atacadao'],
    radiusM: 3000,
  },
  {
    id: 'bakery',
    label: 'Padaria',
    overpass: ['"shop"="bakery"'],
    nominatim: ['shop:bakery'],
    terms: ['padaria', 'panificadora', 'pao'],
    radiusM: 3000,
  },
  {
    id: 'bank',
    label: 'Banco',
    overpass: ['"amenity"~"^(bank|atm)$"'],
    nominatim: ['amenity:bank', 'amenity:atm'],
    terms: ['banco', 'caixa eletronico', 'atm', 'caixa'],
    radiusM: 3000,
  },
  {
    id: 'restaurant',
    label: 'Restaurante',
    overpass: ['"amenity"~"^(restaurant|fast_food)$"'],
    nominatim: ['amenity:restaurant', 'amenity:fast_food'],
    terms: ['restaurante', 'restaurantes', 'lanchonete', 'almoco', 'jantar', 'comer', 'pizzaria', 'hamburgueria'],
    radiusM: 2500,
  },
  {
    id: 'cafe',
    label: 'Cafeteria',
    overpass: ['"amenity"="cafe"'],
    nominatim: ['amenity:cafe'],
    terms: ['cafe', 'cafeteria'],
    radiusM: 3000,
  },
  {
    id: 'gym',
    label: 'Academia',
    overpass: ['"leisure"~"^(fitness_centre|sports_centre)$"'],
    nominatim: ['leisure:fitness_centre', 'leisure:sports_centre'],
    terms: ['academia', 'crossfit'],
    radiusM: 3000,
  },
  {
    id: 'parking',
    label: 'Estacionamento',
    overpass: ['"amenity"="parking"'],
    nominatim: ['amenity:parking'],
    terms: ['estacionamento', 'estacionar', 'parking', 'vaga'],
    radiusM: 2000,
  },
  {
    id: 'charging',
    label: 'Ponto de recarga',
    overpass: ['"amenity"="charging_station"'],
    nominatim: ['amenity:charging_station'],
    terms: ['recarga', 'carregador', 'eletroposto', 'carregar'],
    radiusM: 8000,
  },
  {
    id: 'tyres',
    label: 'Borracharia',
    overpass: ['"shop"="tyres"'],
    nominatim: ['shop:tyres'],
    terms: ['borracharia', 'pneu', 'pneus'],
    radiusM: 5000,
  },
  {
    id: 'repair',
    label: 'Oficina',
    overpass: ['"shop"~"^(car_repair|motorcycle_repair)$"', '"craft"="mechanic"'],
    nominatim: ['shop:car_repair', 'shop:motorcycle_repair'],
    terms: ['oficina', 'mecanica', 'mecanico'],
    radiusM: 5000,
  },
  {
    id: 'bicycle',
    label: 'Bicicletaria',
    overpass: ['"shop"="bicycle"'],
    nominatim: ['shop:bicycle'],
    terms: ['bicicletaria', 'bike', 'bicicleta'],
    radiusM: 8000,
  },
  {
    id: 'school',
    label: 'Escola',
    overpass: ['"amenity"~"^(school|kindergarten)$"'],
    nominatim: ['amenity:school', 'amenity:kindergarten'],
    terms: ['escola', 'colegio', 'creche'],
    radiusM: 3000,
  },
  {
    id: 'mall',
    label: 'Shopping',
    overpass: ['"shop"="mall"'],
    nominatim: ['shop:mall'],
    terms: ['shopping'],
    radiusM: 10000,
  },
  {
    id: 'park',
    label: 'Parque',
    overpass: ['"leisure"~"^(park|garden)$"'],
    nominatim: ['leisure:park', 'leisure:garden'],
    terms: ['parque', 'praca'],
    radiusM: 5000,
  },
]

/** Tira acento e põe em minúsculas — "Farmácia", "farmacia" e "FARMÁCIA" são o mesmo termo. */
export function foldText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/** Palavras que qualificam o pedido sem identificar o lugar: "farmácia perto", "posto mais próximo". */
const FILLER_WORDS = new Set([
  'perto', 'proximo', 'proxima', 'proximos', 'proximas', 'mais', 'de', 'da', 'do', 'das', 'dos', 'em', 'aqui',
  'ai', 'por', 'favor', 'um', 'uma', 'o', 'a', '24h', '24', 'hora', 'horas', 'aberta', 'aberto', 'agora', 'perto',
])

export interface ParsedIntent {
  intent: PlaceIntent
  /** O termo reconhecido, sem acento — é o que se manda aos provedores de texto ("farmacia"). */
  term: string
  /** O que sobrou depois do termo da categoria ("farmácia raia" → "raia"). Vazio = categoria pura. */
  nameFilter: string
}

/**
 * Reconhece "isto é um tipo de lugar".
 *
 * Três formas são aceitas:
 *  - o termo inteiro ("farmácia", "pronto atendimento");
 *  - o termo seguido de qualificadores ("farmácia perto", "posto mais próximo");
 *  - o termo ainda sendo DIGITADO ("farmac", "supermer") — é autocomplete, e a
 *    lista precisa estar certa antes de a palavra terminar.
 *
 * Mais de quatro palavras nunca é categoria: é um nome ou um endereço.
 */
export function parseIntent(query: string): ParsedIntent | null {
  const palavras = foldText(query)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (palavras.length === 0 || palavras.length > 4) return null
  const dobrado = palavras.join(' ')
  // "farmácias", "postos", "hospitais": o botão da tela usa o plural, e quem
  // digita também. Tenta o texto como veio e sem o "s" final de cada palavra.
  const singular = palavras.map((palavra) => (palavra.length > 4 && palavra.endsWith('s') ? palavra.slice(0, -1) : palavra)).join(' ')
  const formas = singular === dobrado ? [dobrado] : [dobrado, singular]

  // Termos de mais palavras primeiro: "pronto atendimento" antes de "pronto".
  const candidatos = INTENTS.flatMap((intent) => intent.terms.map((term) => ({ intent, term })))
  candidatos.sort((a, b) => b.term.length - a.term.length)

  for (const { intent, term } of candidatos) {
    const forma = formas.find((f) => f === term || f.startsWith(`${term} `))
    if (forma) {
      const resto = forma
        .slice(term.length)
        .trim()
        .split(' ')
        .filter((palavra) => palavra && !FILLER_WORDS.has(palavra))
      return { intent, term, nameFilter: resto.join(' ') }
    }
  }

  // Digitando: uma palavra só, já com 4+ letras, que é começo de um termo.
  if (palavras.length === 1 && dobrado.length >= 4) {
    const parcial = candidatos.find(({ term }) => term.startsWith(dobrado) && term !== dobrado)
    if (parcial) return { intent: parcial.intent, term: parcial.term, nameFilter: '' }
  }

  return null
}
