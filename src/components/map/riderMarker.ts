/**
 * Marcador do usuário no mapa — o "RiderPuck".
 *
 * DOIS CAMINHOS, nesta ordem de preferência:
 *
 * 1. SPRITES PNG. Se existirem em `public/markers/`, são usados. É o caminho
 *    de maior fidelidade possível, porque o marcador passa a SER a imagem de
 *    referência em vez de uma aproximação. As referências entregues definem 8
 *    ângulos de 512×512 com fundo transparente.
 * 2. SVG desenhado aqui. É o que roda hoje, e o que roda sempre que um sprite
 *    faltar. Desenhado na mesma linguagem das referências (anel azul no chão,
 *    sombra de contato, cone de direção, raio no guidão), com a limitação
 *    honesta de ser vetor chapado: não tem material, reflexo nem iluminação
 *    volumétrica de um render 3D.
 *
 * POR QUE 8 ÂNGULOS E NÃO ROTAÇÃO CONTÍNUA: as referências são vistas em
 * perspectiva 3/4. Girar uma delas na tela não produz outro ângulo — produz a
 * mesma vista TOMBANDO, o que lê como erro. Com sprites, a direção muda em
 * passos de 45°; é o que a própria especificação assume ("a imagem deve trocar
 * conforme o ângulo"). Só uma vista estritamente de cima poderia girar de
 * forma contínua sem distorcer.
 */

/** Quantos ângulos os sprites cobrem. 8 = passos de 45°, como nas referências. */
const SPRITE_ANGLE_COUNT = 8

const SPRITE_BASE_PATH = '/markers'

export type RiderVehicleKind = 'scooter' | 'moto'

/**
 * Sprites disponíveis, descobertos em tempo de execução.
 *
 * Começa vazio e é preenchido por `probeRiderSprites`. Enquanto estiver vazio,
 * o SVG é usado — então o app funciona igual com ou sem os arquivos, e
 * adicioná-los depois não exige mudar código.
 */
const availableSprites = new Set<RiderVehicleKind>()

/** Ângulo do sprite mais próximo do rumo informado, em passos de 360/8. */
export function nearestSpriteAngle(headingDeg: number): number {
  const step = 360 / SPRITE_ANGLE_COUNT
  const normalized = ((headingDeg % 360) + 360) % 360
  return (Math.round(normalized / step) * step) % 360
}

export function riderSpriteUrl(kind: RiderVehicleKind, headingDeg: number): string {
  return `${SPRITE_BASE_PATH}/${kind}_${nearestSpriteAngle(headingDeg)}.png`
}

export function hasRiderSprites(kind: RiderVehicleKind): boolean {
  return availableSprites.has(kind)
}

/**
 * Verifica UMA vez se os sprites daquele veículo existem.
 *
 * Testa só o ângulo 0: se ele existe, assume-se que o conjunto foi entregue
 * inteiro. Testar os oito custaria oito requisições para responder uma
 * pergunta binária, e um conjunto incompleto é erro de deploy, não um estado
 * que valha a pena tratar.
 *
 * VERIFICAR `response.ok` NÃO BASTA, e isso foi observado na prática: este app
 * é uma SPA, e tanto o servidor de desenvolvimento quanto a Vercel reescrevem
 * qualquer caminho desconhecido para o `index.html` — com status 200. O probe
 * dava "sprites presentes" sem existir PNG nenhum, e o marcador viraria um
 * `<img>` apontando para HTML, ou seja, sumiria do mapa. Por isso a checagem
 * é pelo CONTENT-TYPE: só uma imagem de verdade conta como sprite.
 */
export async function probeRiderSprites(kind: RiderVehicleKind): Promise<boolean> {
  if (availableSprites.has(kind)) return true
  try {
    const response = await fetch(riderSpriteUrl(kind, 0), { method: 'HEAD' })
    if (!response.ok) return false
    if (!(response.headers.get('content-type') ?? '').startsWith('image/')) return false
    availableSprites.add(kind)
    return true
  } catch {
    return false
  }
}
