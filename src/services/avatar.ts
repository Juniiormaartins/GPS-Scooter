/**
 * Preparo da foto do avatar.
 *
 * TRÊS PROBLEMAS RESOLVIDOS AQUI, e nenhum deles é cosmético:
 *
 * 1. TAMANHO. Uma foto de celular tem 3–8 MB. O localStorage inteiro costuma
 *    ter 5 MB, e é onde as preferências do app vivem — salvar o arquivo
 *    original estouraria a cota e derrubaria TODAS as preferências, não só a
 *    foto. Por isso a imagem é reduzida a 256px antes de virar texto.
 *
 * 2. RECORTE. O avatar é um círculo. Uma foto retangular esticada para caber
 *    num círculo distorce o rosto; encaixada, deixa faixas vazias. O recorte
 *    aqui é "cover" a partir do CENTRO — a mesma regra que o olho espera de
 *    uma foto de perfil.
 *
 * 3. ORIENTAÇÃO. Foto tirada na vertical costuma vir com a rotação só na tag
 *    EXIF. `createImageBitmap` com `imageOrientation: 'from-image'` aplica
 *    essa rotação; sem isso, metade das fotos de celular apareceria deitada.
 */

/** Lado do quadrado final, em pixels. 256 cobre o avatar de 42px em telas @3x com folga. */
const AVATAR_SIZE = 256

/** JPEG a 0,82: o data URL fica na casa dos 20–40 KB, bem dentro da cota. */
const AVATAR_QUALITY = 0.82

export const AVATAR_ACCEPTED_TYPES = 'image/png,image/jpeg,image/webp,image/heic,image/heif'

/**
 * Lê o arquivo escolhido e devolve um data URL quadrado.
 *
 * Lança com mensagem legível quando o arquivo não é imagem ou o navegador não
 * consegue decodificá-lo (HEIC em navegador sem suporte, por exemplo) — quem
 * chama mostra a mensagem em vez de falhar em silêncio.
 */
export async function prepareAvatar(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Escolha um arquivo de imagem.')
  }

  const bitmap = await decode(file)

  const canvas = document.createElement('canvas')
  canvas.width = AVATAR_SIZE
  canvas.height = AVATAR_SIZE
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Não foi possível preparar a imagem neste navegador.')

  // Recorte "cover" centralizado: pega o maior quadrado que cabe na foto e o
  // desenha preenchendo o destino.
  const side = Math.min(bitmap.width, bitmap.height)
  const sx = (bitmap.width - side) / 2
  const sy = (bitmap.height - side) / 2
  context.drawImage(bitmap, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE)

  if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close()

  return canvas.toDataURL('image/jpeg', AVATAR_QUALITY)
}

/**
 * `createImageBitmap` é o caminho bom (respeita EXIF e não precisa do DOM),
 * mas Safari só o ganhou tarde. O `<img>` é o plano B — nele a orientação
 * EXIF fica por conta do navegador, que hoje já a aplica na maioria dos
 * casos.
 */
async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      // Formato que o decodificador não abre (HEIC em desktop, por exemplo):
      // tenta o `<img>`, que às vezes dá conta.
    }
  }

  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return image
  } catch {
    throw new Error('Não foi possível abrir esta imagem. Tente uma foto em JPEG ou PNG.')
  } finally {
    // Revogado só depois do `decode`, senão a imagem nunca carrega.
    URL.revokeObjectURL(url)
  }
}
