import type { VehicleModelId } from '@/config/userPreferences'

/**
 * Marcador do usuário no mapa — sprites 3D por veículo.
 *
 * Os assets vêm do pacote `marker_assets_veiculos` (Claude Design): três
 * veículos × 8 ângulos, PNG 512×512 com fundo transparente, renderizados de
 * modelos 3D reais em three.js com câmera ortográfica a 32° de elevação e
 * iluminação idêntica entre eles. É por isso que os oito sprites de um mesmo
 * veículo alternam sem salto de luz ou de escala.
 *
 * CONVENÇÕES DO PACOTE, seguidas à risca:
 *
 * - 0° = veículo visto de FRENTE, crescendo no sentido horário como o heading
 *   da bússola. Índice = `Math.round(heading / 45) % 8`.
 * - O PNG NUNCA é rotacionado. Girar uma vista em perspectiva não produz outro
 *   ângulo, produz a mesma vista tombando — por isso existem os oito arquivos.
 *   Só o halo e o cone de direção acompanham o rumo continuamente.
 * - A âncora é x=50%, y=68% da imagem: o ponto de contato do pneu traseiro com
 *   o chão, não o centro geométrico. Ancorar no centro faria o veículo flutuar
 *   acima da via.
 * - Abaixo de ~40px qualquer um dos três perde legibilidade; aí entra o puck
 *   2D de fallback.
 */

const BASE_PATH = '/markers'

/** Nome dos arquivos, na ordem dos ângulos (0°, 45°, …, 315°). */
const ANGLE_FILES = [
  'marker_0_norte',
  'marker_45_nordeste',
  'marker_90_leste',
  'marker_135_sudeste',
  'marker_180_sul',
  'marker_225_sudoeste',
  'marker_270_oeste',
  'marker_315_noroeste',
] as const

/**
 * Veículo do perfil → pasta de sprites.
 *
 * Os ids do app descrevem o veículo pela velocidade (`scooter-32`), e as
 * pastas do pacote pelo nome do veículo. Este mapa é o único ponto que conhece
 * as duas convenções — trocar de pacote de assets mexe só aqui.
 *
 * `custom` cai na scooter: é o que o usuário estava usando antes de ajustar
 * velocidade ou autonomia à mão, e continua sendo o veículo mais provável.
 */
const SPRITE_FOLDER: Record<VehicleModelId, string> = {
  'scooter-32': 'scooter_eletrica',
  'scooter-25': 'patinete_eletrico_urbano',
  'ebike-25': 'bicicleta_eletrica',
  custom: 'scooter_eletrica',
}

/** Âncora vertical do sprite: ponto de contato do pneu traseiro (68% da altura). */
export const SPRITE_ANCHOR_Y = 0.68

/** Abaixo deste tamanho na tela, o veículo não é mais legível — usar o puck 2D. */
export const MIN_LEGIBLE_SPRITE_PX = 40

export function spriteIndexForHeading(headingDeg: number): number {
  const normalized = ((headingDeg % 360) + 360) % 360
  return Math.round(normalized / 45) % 8
}

export function riderSpriteUrl(vehicle: VehicleModelId, headingDeg: number): string {
  const folder = SPRITE_FOLDER[vehicle] ?? SPRITE_FOLDER['scooter-32']
  return `${BASE_PATH}/${folder}/${ANGLE_FILES[spriteIndexForHeading(headingDeg)]}.png`
}

/** Todos os 8 ângulos de um veículo — usado para pré-carregar e evitar piscada na curva. */
export function allSpriteUrls(vehicle: VehicleModelId): string[] {
  const folder = SPRITE_FOLDER[vehicle] ?? SPRITE_FOLDER['scooter-32']
  return ANGLE_FILES.map((name) => `${BASE_PATH}/${folder}/${name}.png`)
}

export const SHARED_ASSETS = {
  halo: `${BASE_PATH}/compartilhado/halo_localizacao.svg`,
  directionCone: `${BASE_PATH}/compartilhado/indicador_direcao.svg`,
  fallbackPuck: `${BASE_PATH}/compartilhado/puck_2d_fallback.svg`,
} as const

/**
 * Sprites já verificados como presentes.
 *
 * O probe existe porque o app precisa continuar funcionando se o deploy for
 * feito sem a pasta `public/markers` — nesse caso o marcador cai no puck 2D em
 * vez de exibir imagem quebrada.
 */
const verified = new Set<VehicleModelId>()

export function hasRiderSprites(vehicle: VehicleModelId): boolean {
  return verified.has(vehicle)
}

/**
 * Verifica UMA vez se os sprites daquele veículo existem e pré-carrega os oito
 * ângulos.
 *
 * VERIFICAR `response.ok` NÃO BASTA: este app é uma SPA, e tanto o servidor de
 * desenvolvimento quanto a Vercel reescrevem caminho desconhecido para o
 * `index.html` — com status 200. Sem checar o CONTENT-TYPE, o probe diria
 * "presente" sem existir PNG nenhum e o marcador viraria um `<img>` apontando
 * para HTML, ou seja, sumiria do mapa. (Observado na prática.)
 *
 * O pré-carregamento importa para a curva: sem ele, cada troca de ângulo
 * dispararia um download e o marcador piscaria justamente ao virar.
 */
export async function probeRiderSprites(vehicle: VehicleModelId): Promise<boolean> {
  if (verified.has(vehicle)) return true
  try {
    const response = await fetch(riderSpriteUrl(vehicle, 0), { method: 'HEAD' })
    if (!response.ok) return false
    if (!(response.headers.get('content-type') ?? '').startsWith('image/')) return false

    verified.add(vehicle)
    for (const url of allSpriteUrls(vehicle)) {
      const image = new Image()
      image.src = url
    }
    return true
  } catch {
    return false
  }
}
