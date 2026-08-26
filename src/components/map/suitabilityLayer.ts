import type { Map as MapLibreMap, ExpressionSpecification } from 'maplibre-gl'
import { mobilityProfile } from '@/config/mobilityProfiles'
import type { VehicleModelId } from '@/config/userPreferences'
import type { SuitabilityTier, WayKind } from '@/types/routing'

/**
 * CAMADA DE ADEQUAÇÃO DAS VIAS — a cidade inteira colorida pelas regras do
 * veículo, sem precisar traçar rota nenhuma.
 *
 * O que a torna possível sem nenhuma requisição nova: as regras de adequação
 * são uma TABELA de tipo de via para nível (`wayTiers`, em mobilityProfiles), e
 * o tipo da via já vem dentro do tile vetorial que o mapa desenha. Então a
 * classificação inteira cabe numa expressão do MapLibre, avaliada na GPU — não
 * há Overpass, não há cache, não há espera. É a mesma tabela que decide as
 * rotas, aplicada ao mapa em vez de a um trajeto.
 *
 * O QUE ELA NÃO SABE, e a legenda precisa dizer: aqui só entra o TIPO da via.
 * A classificação de uma rota real considera também piso, velocidade do
 * tráfego e restrição de acesso, que vêm do Overpass por trecho. Uma rua pode
 * aparecer verde aqui e virar âmbar na rota por ser de paralelepípedo. Esta
 * camada responde "que tipo de via é esta?", não "esta via específica está boa
 * hoje?".
 */

/** Fonte e camada do estilo MapTiler `streets-v2` — verificados na style.json em uso. */
const SOURCE_ID = 'maptiler_planet'
const SOURCE_LAYER = 'transportation'

export const SUITABILITY_LAYER_ID = 'gps-scooter-suitability'

/**
 * `class` do tile para o vocabulário do perfil.
 *
 * O OpenMapTiles agrupa residencial, `living_street` e `unclassified` num único
 * `minor` — por isso `minor` cai em `residential`, que é o representante mais
 * comum do grupo e tem o mesmo nível em todos os três perfis. Quando existe
 * `subclass`, ela é mais específica e ganha (ver abaixo).
 */
const CLASS_TO_KIND: Partial<Record<string, WayKind>> = {
  motorway: 'motorway',
  trunk: 'trunk',
  primary: 'primary',
  secondary: 'secondary',
  tertiary: 'tertiary',
  minor: 'residential',
  service: 'service',
  path: 'path',
  track: 'track',
  pedestrian: 'pedestrian',
}

/** `subclass` traz o valor do OSM quase cru — é o que separa ciclovia de trilha. */
const SUBCLASS_TO_KIND: Partial<Record<string, WayKind>> = {
  cycleway: 'cycleway',
  footway: 'footway',
  sidewalk: 'footway',
  crossing: 'footway',
  steps: 'steps',
  pedestrian: 'pedestrian',
  path: 'path',
  track: 'track',
  living_street: 'living_street',
  residential: 'residential',
  service: 'service',
  unclassified: 'residential',
}

/**
 * As cores.
 *
 * TRÊS, não cinco. `wayTiers` distingue `very-good` de `good` porque isso
 * importa para PONTUAR uma rota; para olhar a cidade importa "dá / dá com
 * cuidado / não dá". Cinco tons numa malha viária inteira viram um mapa de
 * calor ilegível.
 *
 * O verde é o mais apagado de todos de propósito: a maior parte da cidade é
 * adequada, e se o adequado gritar, o que não é adequado desaparece no meio. O
 * que precisa saltar é a exceção.
 */
const TIER_COLOR: Record<SuitabilityTier, string> = {
  'very-good': '#22A45D',
  good: '#22A45D',
  caution: '#E8901A',
  unsuitable: '#DE3B3B',
  prohibited: '#B01818',
}

const TIER_OPACITY: Record<SuitabilityTier, number> = {
  /*
    MEDIDO NA TELA, não escolhido no editor. A 0,42 o verde cobria a cidade
    inteira e o mapa virava uma malha verde onde as exceções — que são o
    assunto — mal apareciam. A maior parte de qualquer cidade é via adequada;
    se o adequado tiver presença, ele vence por volume e esconde o resto.

    0,22 deixa o verde no nível de "confirmação ao olhar de perto" em vez de
    "informação que salta", que é o papel certo para o caso comum.
  */
  'very-good': 0.22,
  good: 0.22,
  caution: 0.7,
  unsuitable: 0.88,
  prohibited: 0.95,
}

/** Ordem em que a legenda apresenta os níveis, do melhor ao pior. */
export const SUITABILITY_LEGEND: { tier: SuitabilityTier; label: string; color: string }[] = [
  { tier: 'good', label: 'Adequada', color: TIER_COLOR.good },
  { tier: 'caution', label: 'Atenção', color: TIER_COLOR.caution },
  { tier: 'unsuitable', label: 'Não recomendada', color: TIER_COLOR.unsuitable },
  { tier: 'prohibited', label: 'Incompatível', color: TIER_COLOR.prohibited },
]

/**
 * Expressão que resolve o nível de cada feição para o veículo.
 *
 * SUBCLASS PRIMEIRO, class como padrão do `match` — e não o contrário. O
 * `class` de uma ciclovia é `path`, igual ao de uma trilha de terra; só a
 * `subclass` separa as duas, e essa é justamente a distinção que muda tudo para
 * um patinete. Consultar `class` primeiro apagaria a informação mais útil que o
 * tile tem.
 */
function tierExpression(vehicleModelId: VehicleModelId, output: (tier: SuitabilityTier) => string | number) {
  const tiers = mobilityProfile(vehicleModelId).wayTiers

  const byClass: (string | number)[] = []
  for (const [className, kind] of Object.entries(CLASS_TO_KIND)) {
    byClass.push(className, output(tiers[kind as WayKind]))
  }

  const bySubclass: (string | number)[] = []
  for (const [subclass, kind] of Object.entries(SUBCLASS_TO_KIND)) {
    bySubclass.push(subclass, output(tiers[kind as WayKind]))
  }

  return [
    'match',
    ['coalesce', ['get', 'subclass'], ''],
    ...bySubclass,
    ['match', ['coalesce', ['get', 'class'], ''], ...byClass, output(tiers.unknown)],
  ] as unknown as ExpressionSpecification
}

/**
 * Largura da linha.
 *
 * Segue o zoom porque a malha viária também segue: no zoom de cidade há via
 * demais para traços grossos, no zoom de rua um traço fino some sob o
 * desenho da própria rua. Os valores põem a faixa colorida um pouco MAIS
 * ESTREITA que a via desenhada pelo estilo, de propósito — ela deve parecer um
 * realce por dentro da rua, não uma segunda rua por cima.
 */
const WIDTH_EXPRESSION = [
  'interpolate',
  ['exponential', 1.5],
  ['zoom'],
  10,
  1.2,
  13,
  2.4,
  16,
  5,
  19,
  11,
] as unknown as ExpressionSpecification

/**
 * Vias que a camada NÃO pinta.
 *
 * Balsa, trilho, teleférico e plataforma não são vias que um veículo de
 * mobilidade elétrica percorre; colori-las de qualquer cor seria afirmar algo
 * sobre elas. Ficam de fora e o mapa as mostra como sempre.
 */
const EXCLUDED_CLASSES = ['ferry', 'rail', 'aerialway', 'platform', 'pier']

export function applySuitabilityLayer(
  map: MapLibreMap,
  options: { enabled: boolean; vehicleModelId: VehicleModelId },
) {
  const { enabled, vehicleModelId } = options

  if (!enabled) {
    if (map.getLayer(SUITABILITY_LAYER_ID)) map.removeLayer(SUITABILITY_LAYER_ID)
    return
  }

  if (!map.getSource(SOURCE_ID)) return

  const color = tierExpression(vehicleModelId, (tier) => TIER_COLOR[tier])
  const opacity = tierExpression(vehicleModelId, (tier) => TIER_OPACITY[tier])

  if (map.getLayer(SUITABILITY_LAYER_ID)) {
    // Trocar de veículo só reescreve as expressões — remover e readicionar a
    // camada provocaria um piscar da malha inteira a cada troca.
    map.setPaintProperty(SUITABILITY_LAYER_ID, 'line-color', color)
    map.setPaintProperty(SUITABILITY_LAYER_ID, 'line-opacity', opacity)
    return
  }

  /*
    ONDE ENTRA NA PILHA: abaixo do primeiro SÍMBOLO do estilo.

    Assim a cor cobre o desenho das vias (é para isso que ela existe) mas fica
    embaixo de todo nome de rua, rótulo de bairro e ícone de POI. Um realce que
    engole os nomes das ruas tornaria o mapa inutilizável exatamente enquanto o
    usuário tenta se localizar nele.

    Abaixo também das camadas do próprio app (rota, marcadores), que são
    adicionadas depois e portanto ficam por cima naturalmente.
  */
  const firstSymbol = map.getStyle().layers?.find((layer) => layer.type === 'symbol')?.id

  map.addLayer(
    {
      id: SUITABILITY_LAYER_ID,
      type: 'line',
      source: SOURCE_ID,
      'source-layer': SOURCE_LAYER,
      filter: ['all', ['==', ['geometry-type'], 'LineString'], ['!', ['in', ['get', 'class'], ['literal', EXCLUDED_CLASSES]]]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': color,
        'line-opacity': opacity,
        'line-width': WIDTH_EXPRESSION,
      },
    },
    firstSymbol,
  )
}
