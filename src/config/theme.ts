/**
 * Design tokens expostos como hex literais, para consumidores que não podem
 * usar classes Tailwind — hoje só o MapLibre GL (paint properties das camadas
 * do mapa e das rotas).
 *
 * Fonte da verdade: design/gps-scooter-ui/tokens/colors.css (handoff de
 * design). Os valores aqui e os de tailwind.config.js precisam continuar
 * batendo entre si e com aquele arquivo — se um mudar, mude os três.
 */

/** Acentos semânticos — cada um tem uma função fixa (ver README do handoff). */
export const ACCENT = {
  primary: '#35B7F7', // navegação, links, seleção, rota ativa
  go: '#2FD16A', // confirmar/iniciar, bateria, rota segura
  warn: '#F5A623', // locais salvos, rota alternativa
  danger: '#F04545', // destrutivo, via não recomendada
} as const

/**
 * Cartografia — aplicada ao estilo do mapa REAL do provedor (MapTiler), não a
 * um mapa desenhado. Ver MapView.tsx: as camadas do estilo são recoloridas em
 * tempo de execução com estes valores.
 *
 * Contraste verificado: fundo #0E1424 contra via principal #2B3A56 tem
 * diferença de luminosidade ~3x — legível de verdade, diferente do estilo
 * "dark" pronto do Mapbox que tínhamos antes (~1,5x, ilegível).
 */
/**
 * Cartografia do tema CLARO. Mesma lógica do escuro, invertida com cuidado:
 * as vias ficam BRANCAS sobre um fundo cinza-azulado (é assim que mapas
 * claros criam hierarquia), e as principais ganham um cinza levemente mais
 * quente para se destacarem das secundárias.
 */
/**
 * FITA DA ROTA — a composição em camadas do traçado principal.
 *
 * A referência não é "uma linha azul". Olhando de perto, o traçado dela tem
 * quatro coisas empilhadas, e é o conjunto que dá o acabamento:
 *
 *   1. um halo difuso em volta, que descola a rota do mapa;
 *   2. um CONTORNO azul-marinho escuro, que é o que dá profundidade — não é
 *      branco nem a cor do fundo, é azul escuro, e por isso a fita parece ter
 *      espessura em vez de parecer adesivada;
 *   3. um miolo azul vivo e saturado, bem mais forte que o ciano claro que
 *      usávamos;
 *   4. um brilho central mais claro, estreito, que sugere a luz batendo em
 *      cima da fita.
 *
 * POR QUE TOKENS PRÓPRIOS E NÃO `routeSelected`: `routeSelected` é o azul da
 * MARCA (`ACCENT.primary`), e ele governa botão ativo, aba, marcador e seleção
 * na interface inteira. Saturar aquele token para agradar ao traçado mudaria o
 * app todo. A fita passa a ter paleta própria, derivada do mesmo azul mas
 * livre para ser mais viva — o parentesco continua óbvio no olho.
 *
 * O MapLibre não faz pós-processamento: não há bloom nem degradê real de
 * volume. `line-gradient` existiria, mas exige `lineMetrics` e é EXCLUSIVO com
 * cor orientada a dados — usá-lo apagaria as cores por trecho (âmbar e
 * vermelho), que são informação e não podem ser sacrificadas por estética.
 * Daí a escolha por empilhamento de camadas, que convive com o `match` de
 * severidade.
 */
export const ROUTE_RIBBON = {
  dark: {
    /** Halo. Mais claro que o miolo, senão o brilho lê como borrão sujo. */
    glow: '#3AA0FF',
    /** Contorno de profundidade. Azul-marinho: escuro o bastante para virar borda, azul o bastante para não virar sombra preta. */
    rim: '#0B3F97',
    /** Miolo. Azul vivo, bem mais saturado que o ciano #35B7F7 anterior. */
    core: '#2A8DFF',
    /** Brilho central. */
    sheen: '#AEDDFF',
    /** Vinco externo que separa a fita do mapa. No escuro é quase o fundo. */
    separator: '#050A14',
  },
  light: {
    glow: '#2E93FF',
    /** No tema claro o contorno precisa ser MAIS escuro: ele compete com ruas brancas, não com fundo escuro. */
    rim: '#083A8F',
    core: '#0F6FE0',
    sheen: '#8CC8FF',
    /** No claro o vinco é branco — é o que descola a fita do fundo cinza-azulado. */
    separator: '#FFFFFF',
  },
} as const

/**
 * Contornos dos trechos NÃO recomendados.
 *
 * O acabamento novo vale para a fita inteira, não só para o azul: um trecho
 * âmbar ou vermelho com contorno azul-marinho ficaria descolado do próprio
 * miolo. Cada severidade ganha a versão escurecida da sua cor, então o trecho
 * continua sendo lido como âmbar/vermelho — a regra de sinalização não muda,
 * só o acabamento acompanha.
 *
 * SÓ O CRÍTICO MUDOU, e a distinção é do produto, não estética.
 *
 * A escala tem três leituras: AZUL quando pode trafegar, MARROM/ÂMBAR quando a
 * via não é ideal mas dá, VERMELHO quando não se deve estar ali. O marrom do
 * nível de atenção é deliberado e fica como está — é ele que diz "não é
 * proibido, é só ruim".
 *
 * O problema era o CRÍTICO virar marrom também, apagando justamente a
 * distinção. #7C1414 é escurecido a ponto de perder saturação: o olho lê vinho,
 * e a essa espessura vinho é indistinguível do marrom de atenção. E o contorno
 * não é um detalhe fino — no zoom de rua tem 17px contra 12px do miolo, ou
 * seja, 2,5px de cada lado; em zoom de bairro responde por quase metade da
 * largura da fita. A via crítica lia como marrom com um fio vermelho dentro.
 *
 * #A81620 continua mais escuro que o miolo (é o que faz a borda existir) mas
 * permanece inequivocamente VERMELHO em qualquer espessura.
 */
export const SEVERITY_RIM = {
  attention: '#7A4B05',
  critical: '#A81620',
} as const

/**
 * Brilho central por severidade.
 *
 * BUG QUE ISTO CONSERTA. O brilho era o azul-claro da fita, fixo, aplicado a
 * 34% SOBRE o miolo. Sobre um trecho azul funcionava; sobre um trecho
 * VERMELHO, azul claro por cima dessatura o vermelho e o puxa para marrom —
 * era exatamente o relato: "BR aparecendo com preenchimento marrom e apenas
 * um contorno vermelho". O contorno continuava vermelho porque ele é a única
 * camada que já seguia a severidade.
 *
 * Cada severidade passa a ter o clareamento da PRÓPRIA cor, então o brilho
 * volta a ser volume e não uma tinta por cima.
 *
 * SEGUNDA PASSADA, de novo só no CRÍTICO: #FFC2C2 é um rosa quase branco.
 * Sobre um miolo vermelho, um fio rosa-claro bem no CENTRO da fita — que é onde
 * o olho pousa — tirava a saturação exatamente do ponto mais visível. Somado ao
 * contorno vinho, era isso que fazia a via crítica parecer marrom, confundindo-a
 * com o nível de atenção.
 *
 * #F2585E é a própria cor CLAREADA, não embranquecida: continua mais claro que
 * o miolo (o volume permanece) sem deixar de ser vermelho. O âmbar do nível de
 * atenção fica como estava — lá o resultado marrom é o desejado.
 */
export const SEVERITY_SHEEN = {
  attention: '#FFE0A3',
  critical: '#F2585E',
} as const

export const MAP_COLORS_LIGHT = {
  /**
   * MEDIDO, não escolhido no olho. A versão anterior usava fundo #EEF1F7 com
   * vias #F7F9FD/#FFFFFF, o que dá razão de contraste de 1,07:1 entre rua e
   * fundo e 1,05:1 entre rua secundária e principal — ou seja, nenhuma
   * hierarquia e ruas praticamente invisíveis. Somado a isso, os prédios
   * ficavam MAIS escuros que as ruas, então a massa construída lia como
   * figura e a malha viária como fundo: exatamente o inverso do que um GPS
   * precisa. Escurecer o fundo é o que faz a rua branca aparecer.
   */
  background: '#E9EDF2',
  water: '#A5CFF0',
  /** Vias brancas: o elemento mais claro do mapa, por decisão. */
  roadMajor: '#FFFFFF',
  roadMinor: '#FFFFFF',
  /** Expressas/rodovias em âmbar — no nosso caso isso é informação, não enfeite: é o que o app recomenda evitar. */
  roadHighway: '#F7CE7E',
  /**
   * Contorno das vias — o elemento que MAIS mudou.
   *
   * Era #A9B9D1 sobre fundo #D3DCEA: pouco mais escuro que o próprio fundo,
   * então a rua branca aparecia por diferença de preenchimento e o mapa
   * inteiro dependia do fundo ser escuro para funcionar. É por isso que ele
   * era escuro, e é por isso que o mapa parecia apagado.
   *
   * Aqui o contorno é que desenha a via. Com ele nítido dá para clarear o
   * fundo sem a malha sumir — que é como um mapa claro moderno resolve: fundo
   * quase branco, rua branca, e a definição vindo da borda.
   */
  roadCasing: '#BCC7D6',
  /** Prédios DELIBERADAMENTE discretos — quase o fundo. Eles não são a informação. */
  building: '#DCE3EC',
  rail: '#C3CCD9',
  /** Trilhas/calçadões em tom quente, para não serem confundidos com rua. */
  path: '#E6D8BC',
  poi: '#AFBDD2',
  /**
   * Áreas verdes com presença de verdade. O tom anterior (#C3DCC3) era um
   * cinza levemente esverdeado que sumia contra o fundo; este é um verde
   * reconhecível de relance, que é a função de praça e parque num mapa —
   * servir de referência de orientação.
   */
  greenArea: '#B4DFB0',
  label: '#33404F',

  /**
   * Rotas no tema claro: tons mais escuros/saturados que os do tema escuro.
   * O ciano #35B7F7 e o verde #2FD16A brilham sobre fundo escuro, mas perdem
   * contraste sobre um mapa claro — aqui usam as variantes 600 da paleta.
   */
  routeSelected: '#0E86C6',
  routeCasing: '#FFFFFF',
  routeByEligibility: {
    allowed: '#17A34A',
    discouraged: '#B3730A',
    'not-allowed': '#D92626',
  },
} as const

export const MAP_COLORS = {
  background: '#0B111F',
  /**
   * Água precisa diferir do fundo. Antes era EXATAMENTE a mesma cor (#0E1424),
   * então rio e lago liam como quarteirão vazio. O primeiro ajuste (#10263F)
   * ainda dava só 1,23:1; este dá ~1,9:1, na mesma faixa das vias — água é
   * referência de orientação, precisa ser reconhecível de relance.
   */
  /**
   * Azul mais saturado que o #17395E anterior. O escuro não precisa ser
   * apagado: água e verde são os únicos pontos de cor do mapa noturno, e é
   * neles que o olho se apoia para se localizar.
   */
  water: '#1B4C7E',
  roadMajor: '#546890',
  /** Expressas/rodovias em âmbar apagado — mesma função informativa do tema claro. */
  roadHighway: '#7A6437',
  roadCasing: '#0B111F',
  building: '#131B2D',
  rail: '#2B3752',
  path: '#33453B',
  /** Verde noturno — mais vivo que o #12251A anterior, pelo mesmo motivo da água. */
  greenArea: '#163A26',
  /**
   * DESVIO CONSCIENTE do handoff, documentado: ele especifica #131C2E
   * (--ink-850) para vias secundárias, mas contra o fundo #0E1424 isso dá
   * razão de contraste ~1,07:1 — invisível. Como a maioria das ruas de
   * Goiânia é "via secundária", o mapa ficaria só com as duas artérias
   * principais visíveis (foi exatamente o sintoma relatado antes).
   * Subimos a rampa de novo depois de medir: com #212D45 o contraste com o
   * fundo era 1,35:1 e o degrau para a via principal, 1,20:1. Os valores
   * atuais dão 1,85:1 para o fundo e 1,52:1 entre secundária e principal —
   * na mesma faixa em que um GPS de referência opera, mantendo a paleta.
   */
  roadMinor: '#33425F',
  poi: '#3B4C6B',
  /**
   * Rótulos bem mais claros que antes (#8A9CB6). Nome de rua é lido de
   * relance, em movimento, muitas vezes sob sol — é o texto que menos pode
   * economizar contraste.
   */
  label: '#C6D5EA',

  /** Rota confirmada em navegação ativa. */
  routeLine: ACCENT.primary,
  /** Contorno sob a linha da rota — no tema escuro é o próprio fundo do mapa, não branco. */
  routeCasing: '#0E1424',

  /**
   * Candidatas simultâneas na tela de seleção.
   *
   * A rota SELECIONADA usa sempre o azul da marca (`routeSelected`), não a
   * cor da elegibilidade: azul é o token de "seleção/navegação" em todo o
   * app (botão ativo, aba ativa, marcador do usuário), então a linha
   * escolhida fica visualmente ligada aos marcadores de origem/destino e ao
   * resto da interface — o verde antes fazia a rota principal parecer
   * desconectada da identidade.
   *
   * As NÃO selecionadas mantêm a cor semântica, que é onde ela carrega
   * informação de verdade: dá para bater o olho e ver qual alternativa é
   * adequada (verde), com ressalva (âmbar) ou inadequada (vermelha).
   */
  routeSelected: ACCENT.primary,
  routeByEligibility: {
    allowed: ACCENT.go,
    discouraged: ACCENT.warn,
    'not-allowed': ACCENT.danger,
  },

  /** Marcador da posição do usuário. */
  puckFill: ACCENT.primary,
  puckHalo: 'rgba(53,183,247,.22)',
} as const
