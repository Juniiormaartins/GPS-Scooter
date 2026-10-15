/**
 * Proxy de mesma origem para a Overpass API.
 *
 * POR QUE ISTO EXISTE. O app consultava `overpass-api.de` direto do navegador.
 * Quando a instância pública responde 200, ela manda `Access-Control-Allow-
 * Origin: *` e tudo funciona. Mas quando ela RECUSA — 429 por limite de taxa,
 * 504 de gateway — a página de erro sai SEM esse cabeçalho. O navegador então
 * bloqueia a resposta e entrega ao código um `TypeError: Failed to fetch`
 * genérico: o app não consegue ler o status, não sabe que foi limite de taxa e
 * não tem como reagir de forma diferente de uma queda de rede.
 *
 * Foi exatamente esse o sintoma investigado: em produção, cinco consultas
 * seguidas falhavam com "Failed to fetch" e a rota ficava sem classificação
 * por trecho, exibindo "Dados das vias indisponíveis agora".
 *
 * Passando pelo nosso próprio domínio, a requisição deixa de ser
 * cross-origin: o status real chega ao cliente e o tratamento de erro volta a
 * ser possível. Em desenvolvimento o mesmo caminho `/api/overpass` é servido
 * pelo proxy do Vite (ver vite.config.ts), então os dois ambientes exercitam
 * exatamente o mesmo código — que era a divergência de ambiente a eliminar.
 */

const OVERPASS_UPSTREAM = 'https://overpass-api.de/api/interpreter'

/**
 * SERVIDOR RESERVA.
 *
 * O Overpass principal é gratuito e compartilhado, e falha de vez em quando:
 * medido, 504 depois de 10 s numa consulta de 4 km². Quando falha, a rota fica
 * sem classificação e o app não sabe dizer qual é a mais recomendada.
 *
 * Dos espelhos públicos testados na mesma hora, só este respondeu (200 em 29 s,
 * 620 KB); `overpass.kumi.systems` e `overpass.private.coffee` não responderam
 * em 40 s. Não está nos dois primeiros por ser mais lento — entra como RESERVA.
 *
 * Consulta DEDICADA em vez de esperar: se o principal não resolveu em
 * `HEDGE_AFTER_MS` (ou falhou antes), o reserva é consultado também, e vale a
 * primeira resposta boa. Custa uma consulta a mais só nos casos lentos.
 */
const OVERPASS_MIRRORS = ['https://maps.mail.ru/osm/tools/overpass/api/interpreter']
const HEDGE_AFTER_MS = 6000

/** Declara à Vercel que esta função pode levar até 60 s: o reserva pode levar 30. */
export const config = { maxDuration: 60 }

/** Teto do lado do servidor. A função da Vercel tem limite próprio; este chega antes, para responder algo útil. */
const UPSTREAM_TIMEOUT_MS = 55000

interface RequestLike {
  method?: string
  body?: unknown
  on?: (evento: string, ouvinte: (...args: never[]) => void) => void
}

/**
 * Lê o corpo da requisição.
 *
 * O runtime da Vercel desserializa automaticamente `application/json` e
 * formulários, mas para `text/plain` o comportamento variou entre versões:
 * às vezes chega string, às vezes `undefined`. Como o corpo aqui É a consulta
 * Overpass, cair no `undefined` significaria responder 400 para toda consulta
 * — daí a leitura do fluxo como último recurso.
 */
async function lerCorpo(request: RequestLike): Promise<string> {
  if (typeof request.body === 'string') return request.body
  if (request.body != null && typeof request.body === 'object') {
    // Corpo já desserializado como objeto: não é o nosso formato, mas
    // reconstruir é melhor que descartar.
    return String((request.body as { query?: string }).query ?? '')
  }
  if (typeof request.on !== 'function') return ''
  return new Promise<string>((resolve) => {
    let dados = ''
    const req = request as unknown as {
      on: (evento: string, ouvinte: (pedaco?: unknown) => void) => void
    }
    req.on('data', (pedaco) => {
      dados += String(pedaco)
    })
    req.on('end', () => resolve(dados))
    req.on('error', () => resolve(''))
  })
}

interface ResponseLike {
  status: (code: number) => ResponseLike
  setHeader: (name: string, value: string) => void
  send: (body: string) => void
  json: (body: unknown) => void
}

export default async function handler(request: RequestLike, response: ResponseLike) {
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Use POST com a consulta Overpass no corpo.' })
    return
  }

  const query = await lerCorpo(request)
  if (!query.trim()) {
    response.status(400).json({ error: 'Consulta vazia.' })
    return
  }

  const UA = 'GPS-Scooter/1.0 (navegacao para mobilidade eletrica leve; +https://gps-scooter.vercel.app)'

  interface Resposta {
    status: number
    text: string
    contentType: string | null
  }

  const controladores: AbortController[] = []
  const abortaTodos = () => controladores.forEach((c) => c.abort())
  const timer = setTimeout(abortaTodos, UPSTREAM_TIMEOUT_MS)

  async function consulta(url: string): Promise<Resposta> {
    const controller = new AbortController()
    controladores.push(controller)
    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        /**
         * USER-AGENT EXPLÍCITO — NÃO REMOVER.
         *
         * A instância pública recusa com **406 Not Acceptable** requisições
         * sem User-Agent ou com um genérico. Medido, mesma consulta: sem UA →
         * 406; UA "node" → 406; UA identificando a aplicação → 200.
         *
         * Do navegador isso nunca apareceu, porque o próprio navegador põe o
         * seu UA. Ao mover a chamada para o servidor, o `fetch` do runtime
         * manda o dele — e foi assim que o proxy passou a levar 406 onde o
         * cliente levava 200. A política de uso do Overpass também exige
         * identificação da aplicação, então isto não é contorno.
         */
        'User-Agent': UA,
      },
      body: query,
      signal: controller.signal,
    })
    return { status: upstream.status, text: await upstream.text(), contentType: upstream.headers.get('content-type') }
  }

  /**
   * Principal primeiro; reserva se o principal demorar ou falhar. Devolve a
   * primeira resposta 200 — ou, se nenhuma for, a do principal, para o cliente
   * ver o status real (429/504) e reagir.
   */
  function corrida(): Promise<Resposta | null> {
    return new Promise((resolve) => {
      let resolvido = false
      let pendentes = 0
      let reservaIniciado = false
      let falhaDoPrincipal: Resposta | null = null
      let hedgeTimer: ReturnType<typeof setTimeout> | undefined

      const terminou = () => {
        if (resolvido) return
        if (pendentes === 0 && reservaIniciado) {
          resolvido = true
          resolve(falhaDoPrincipal)
        }
      }

      const iniciaReserva = () => {
        if (reservaIniciado) return
        reservaIniciado = true
        if (hedgeTimer) clearTimeout(hedgeTimer)
        for (const mirror of OVERPASS_MIRRORS) dispara(mirror, false)
        terminou()
      }

      const dispara = (url: string, ePrincipal: boolean) => {
        pendentes++
        consulta(url)
          .then((resposta) => {
            if (resolvido) return
            if (resposta.status === 200) {
              resolvido = true
              if (hedgeTimer) clearTimeout(hedgeTimer)
              resolve(resposta)
              return
            }
            if (ePrincipal) {
              falhaDoPrincipal = resposta
              // Recusou ANTES do prazo: não há por que esperar o relógio.
              iniciaReserva()
            }
          })
          .catch(() => {
            if (ePrincipal) iniciaReserva()
          })
          .finally(() => {
            pendentes--
            terminou()
          })
      }

      dispara(OVERPASS_UPSTREAM, true)
      hedgeTimer = setTimeout(iniciaReserva, HEDGE_AFTER_MS)
    })
  }

  try {
    const vencedora = await corrida()

    if (!vencedora) {
      // Ninguém respondeu: 504 e não 500 — a origem não respondeu a tempo, e é
      // isso que o cliente precisa distinguir de uma consulta malformada.
      response.status(504)
      response.json({ error: 'Overpass não respondeu a tempo.' })
      return
    }

    /**
     * O STATUS DE ORIGEM É REPASSADO COMO ESTÁ.
     *
     * Traduzir 429 em 200 com corpo vazio pareceria "sem dados de via" e
     * esconderia justamente o que o cliente precisa saber para esperar e
     * tentar de novo. Ver o tratamento em segmentEnrichment.ts.
     */
    response.status(vencedora.status)
    response.setHeader('Content-Type', vencedora.contentType ?? 'application/json')
    // A malha viária de uma área muda em escala de dias; um cache de borda
    // curto elimina a maior parte das consultas repetidas ao endpoint público,
    // que é o recurso escasso aqui (2 slots simultâneos por IP).
    response.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
    response.send(vencedora.text)
  } catch (error) {
    const abortado = error instanceof Error && error.name === 'AbortError'
    response.status(abortado ? 504 : 502)
    response.json({ error: abortado ? 'Overpass não respondeu a tempo.' : 'Falha ao consultar a Overpass.' })
  } finally {
    clearTimeout(timer)
    // Quem perdeu a corrida não precisa continuar ocupando um slot.
    abortaTodos()
  }
}
