/**
 * Normalização das instruções faladas.
 *
 * O Valhalla entrega quatro textos por manobra, e são bons: `instruction`
 * (tela), `verbal_transition_alert_instruction` (aviso antecipado),
 * `verbal_pre_transition_instruction` (no momento da manobra) e
 * `verbal_post_transition_instruction` ("Continue por 800 metros"). Estávamos
 * ignorando os três últimos e montando texto próprio, o que jogava fora tanto
 * a estrutura de três estágios quanto a contagem de saída de rotatória.
 *
 * O QUE PRECISA DE CONSERTO: a locale pt-BR do Valhalla é INCOMPLETA para
 * rotatórias. Quando a rotatória tem nome, ele cai no template em inglês —
 * verificado na API:
 *
 *   "Enter Praça Delmiro Paulino da Silva and take the 3ª exit onto Avenida…"
 *
 * Repare o "3ª" em português dentro da frase em inglês: é locale parcial, não
 * falta de dado. Sem nome, ele acerta ("Saia da rotatória para…").
 *
 * Reescrever aqui não é inventar: a contagem de saída vem do campo
 * `roundabout_exit_count` e o nome da via está no próprio texto. Só a moldura
 * da frase é trocada.
 */

/** Ordinais por extenso — "na 3ª saída" lido em voz alta vira "na três-a saída". */
const ORDINALS = ['', 'primeira', 'segunda', 'terceira', 'quarta', 'quinta', 'sexta', 'sétima', 'oitava']

export function ordinalExit(count: number): string {
  return ORDINALS[count] ?? `${count}ª`
}

/**
 * Padrões em inglês que a locale pt-BR do Valhalla deixa passar.
 *
 * Deliberadamente ancorados no início e tolerantes ao miolo: o que varia é o
 * nome da rotatória e da via, e é justamente o que queremos capturar.
 */
const ENTER_ROUNDABOUT = /^Enter\s+(.+?)\s+and take the\s+\S+\s+exit(?:\s+(?:onto|toward)\s+(.+?))?\.?$/i
const ENTER_ROUNDABOUT_PLAIN = /^Enter the roundabout(?:\s+and take the\s+\S+\s+exit)?(?:\s+(?:onto|toward)\s+(.+?))?\.?$/i
const EXIT_ROUNDABOUT = /^Exit the roundabout(?:\s+(?:onto|toward)\s+(.+?))?\.?$/i

/**
 * Traduz o que a locale deixou em inglês. Texto já em português passa intacto.
 *
 * `exitCount` vem de `roundabout_exit_count`; quando ausente, a frase sai sem
 * a contagem em vez de chutar um número.
 */
export function normalizeInstruction(text: string, exitCount?: number | null): string {
  const trimmed = text.trim()

  const enterNamed = trimmed.match(ENTER_ROUNDABOUT)
  if (enterNamed) {
    const [, roundaboutName, exitStreet] = enterNamed
    const exit = exitCount ? ` e siga pela ${ordinalExit(exitCount)} saída` : ''
    const onto = exitStreet ? ` para ${exitStreet}` : ''
    // O nome da rotatória entra só quando é um lugar reconhecível ("Praça X"),
    // não quando é um código de viário que ninguém usa falando.
    const where = /^(pra[çc]a|rotat[óo]ria|largo)/i.test(roundaboutName) ? ` na ${roundaboutName}` : ''
    return `Entre na rotatória${where}${exit}${onto}.`
  }

  const enterPlain = trimmed.match(ENTER_ROUNDABOUT_PLAIN)
  if (enterPlain) {
    const exit = exitCount ? ` e siga pela ${ordinalExit(exitCount)} saída` : ''
    const onto = enterPlain[1] ? ` para ${enterPlain[1]}` : ''
    return `Entre na rotatória${exit}${onto}.`
  }

  const exitRoundabout = trimmed.match(EXIT_ROUNDABOUT)
  if (exitRoundabout) {
    return exitRoundabout[1] ? `Saia da rotatória para ${exitRoundabout[1]}.` : 'Saia da rotatória.'
  }

  return trimmed
}

/**
 * Sobrou algum inglês depois da normalização?
 *
 * Não corrige nada — serve para o desenvolvimento perceber uma moldura nova
 * que a locale do Valhalla deixe passar no futuro, em vez de ela chegar
 * silenciosamente ao usuário.
 */
const ENGLISH_MARKERS = /\b(enter|exit|turn|continue|head|keep|merge|onto|toward|roundabout|slight|sharp)\b/i

export function looksEnglish(text: string): boolean {
  return ENGLISH_MARKERS.test(text)
}
