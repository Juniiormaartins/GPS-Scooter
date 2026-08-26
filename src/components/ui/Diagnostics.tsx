import { useEffect, useState } from 'react'

/**
 * PAINEL DE DIAGNÓSTICO — aberto com `?diag=1` na URL.
 *
 * POR QUE ISTO EXISTE. Duas correções seguidas de layout falharam no aparelho
 * do usuário sem falhar aqui, e a razão é simples: o ambiente de teste não tem
 * safe area, não tem modo standalone e não tem a barra de status do iOS. Cada
 * tentativa virava um palpite, e o custo do palpite é uma ida e volta com ele.
 *
 * Este painel troca palpite por MEDIÇÃO: mostra, na tela do próprio aparelho,
 * os números que decidem o layout. Um print dele responde de uma vez qual das
 * hipóteses é a verdadeira — inclusive a mais chata delas, que é o ícone da
 * tela de início apontar para uma URL de deploy antiga (o `href` está no topo).
 *
 * Não é código de produção disfarçado: sem estar ligado, nada disto é montado.
 */

/**
 * O estado FICA GRAVADO, e não depende do parâmetro continuar na URL.
 *
 * Motivo concreto: ao adicionar o app à tela de início, o iOS abre a URL que
 * foi salva — e o `?diag=1` se perde no caminho ou nunca esteve lá. Como o
 * modo standalone é justamente o único em que o problema aparece, um
 * diagnóstico que só funciona com parâmetro é um diagnóstico que não funciona
 * onde é preciso.
 *
 * `?diag=1` liga e grava; `?diag=0` desliga e apaga.
 */
const CHAVE = 'gps-scooter:diag'

/**
 * Liga/desliga e recarrega.
 *
 * Recarregar é deliberado: o painel lê medidas no momento em que monta, e
 * ligá-lo no meio de uma sessão daria números já influenciados pelo estado da
 * tela naquele instante. Uma abertura limpa é o que se quer reportar.
 */
export function setDiagnosticsEnabled(ligado: boolean): void {
  try {
    if (ligado) localStorage.setItem(CHAVE, '1')
    else localStorage.removeItem(CHAVE)
  } catch {
    // Sem armazenamento não há o que alternar; o parâmetro de URL ainda serve.
  }
  window.location.reload()
}

export function diagnosticsEnabled(): boolean {
  const parametro = new URLSearchParams(window.location.search).get('diag')
  try {
    if (parametro === '1') {
      localStorage.setItem(CHAVE, '1')
      return true
    }
    if (parametro === '0') {
      localStorage.removeItem(CHAVE)
      return false
    }
    return localStorage.getItem(CHAVE) === '1'
  } catch {
    // localStorage indisponível: vale só o parâmetro desta visita.
    return parametro === '1'
  }
}

/** Lê um `env(safe-area-inset-*)` de verdade, medindo um elemento sonda. */
function medirInset(lado: 'top' | 'bottom'): number {
  const sonda = document.createElement('div')
  sonda.style.cssText = `position:fixed;left:0;width:0;visibility:hidden;height:env(safe-area-inset-${lado},0px)`
  document.body.appendChild(sonda)
  const valor = sonda.getBoundingClientRect().height
  sonda.remove()
  return Math.round(valor)
}

export function Diagnostics() {
  const [linhas, setLinhas] = useState<[string, string][]>([])

  useEffect(() => {
    const medir = () => {
      const raiz = document.getElementById('root')
      const canvas = document.querySelector('.maplibregl-canvas')
      const scrim = document.querySelector('[aria-hidden="true"].absolute.inset-x-0.top-0')
      const cs = getComputedStyle(document.documentElement)

      const canvasRect = canvas?.getBoundingClientRect()
      const scrimRect = scrim?.getBoundingClientRect()

      setLinhas([
        ['url', location.host + location.pathname],
        ['build', String(__BUILD_TIME__).slice(0, 16)],
        ['standalone(attr)', document.documentElement.dataset.standalone ?? 'não'],
        ['standalone(media)', String(window.matchMedia('(display-mode: standalone)').matches)],
        ['inset topo', `${medirInset('top')}px`],
        ['inset base', `${medirInset('bottom')}px`],
        ['--safe-top', cs.getPropertyValue('--safe-top').trim() || '(vazio)'],
        ['innerHeight', `${window.innerHeight}px`],
        ['visualViewport', `${Math.round(window.visualViewport?.height ?? 0)}px`],
        ['body altura', `${Math.round(document.body.getBoundingClientRect().height)}px`],
        ['#root altura', `${Math.round(raiz?.getBoundingClientRect().height ?? 0)}px`],
        ['canvas base', `${Math.round(canvasRect?.bottom ?? 0)}px`],
        ['SOBRA NA BASE', `${Math.round(window.innerHeight - (canvasRect?.bottom ?? 0))}px`],
        ['scrim altura', `${Math.round(scrimRect?.height ?? 0)}px`],
        ['scrim topo alfa', (cs.getPropertyValue('--scrim-top').match(/[\d.]+\)/)?.[0] ?? '?').replace(')', '')],
        ['doc rolável', String(document.documentElement.scrollHeight > document.documentElement.clientHeight)],
      ])
    }

    medir()
    // Remede depois que o iOS assenta o layout — parte das divergências só
    // aparece um instante após a abertura.
    const t = setTimeout(medir, 1500)
    window.addEventListener('resize', medir)
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', medir)
    }
  }, [])

  return (
    <div className="pointer-events-none absolute inset-x-2 top-1/2 z-[999] -translate-y-1/2 rounded-xl bg-[rgba(10,14,26,.94)] p-3 font-mono text-[11px] leading-[1.5] text-white shadow-float">
      {linhas.map(([chave, valor]) => (
        <div key={chave} className="flex justify-between gap-3">
          <span className="text-white/60">{chave}</span>
          <span className={chave.startsWith('SOBRA') ? 'font-bold text-amber-300' : ''}>{valor}</span>
        </div>
      ))}
    </div>
  )
}
