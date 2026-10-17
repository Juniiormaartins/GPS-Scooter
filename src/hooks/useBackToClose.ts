import { useEffect, useRef } from 'react'

/**
 * Faz o gesto/botão "voltar" do celular fechar uma tela sobreposta (painel,
 * busca) em vez de sair do app. Ao abrir, empilha uma entrada no histórico;
 * o "voltar" desempilha essa entrada e chama `onClose`. Se a tela for fechada
 * por outro caminho (botão de seta), a entrada é desempilhada aqui.
 */
export function useBackToClose(open: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    let closedByBack = false
    window.history.pushState({ gpsOverlay: true }, '')
    const onPop = () => {
      closedByBack = true
      onCloseRef.current()
    }
    window.addEventListener('popstate', onPop, { once: true })
    return () => {
      window.removeEventListener('popstate', onPop)
      if (!closedByBack && window.history.state?.gpsOverlay) window.history.back()
    }
  }, [open])
}
