import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App'
import '@/index.css'
import { registerServiceWorker } from '@/pwa'

/**
 * Marca que o app foi aberto pelo ÍCONE da tela de início.
 *
 * Serve a uma coisa só, mas importante: nesse modo a página se estende por
 * baixo da barra de status do iOS, e `env(safe-area-inset-top)` volta ZERO em
 * várias versões — sem um piso, o cabeçalho sobe para debaixo do relógio. O
 * `--safe-top` em index.css usa este atributo para aplicar esse piso.
 *
 * `navigator.standalone` é a propriedade legada do iOS e não existe no tipo
 * padrão de `Navigator`; a media query `display-mode: standalone` cobre o resto
 * e está no CSS. As duas juntas porque nenhuma sozinha pega todos os aparelhos.
 */
const abertoComoApp =
  (navigator as Navigator & { standalone?: boolean }).standalone === true ||
  window.matchMedia('(display-mode: standalone)').matches
if (abertoComoApp) document.documentElement.dataset.standalone = 'true'

/*
  QUAL SISTEMA. Os recuos de topo e base têm uma regra do iOS (piso para o
  `env(safe-area-inset-*)` que ele zera) que no Android só desperdiça espaço —
  ver index.css. iPadOS se apresenta como Mac: o toque o denuncia.
*/
const ehIOS =
  /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
document.documentElement.dataset.platform = ehIOS ? 'ios' : 'other'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

document.getElementById('splash')?.remove()
registerServiceWorker()
