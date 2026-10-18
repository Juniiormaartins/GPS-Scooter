import { useEffect } from 'react'

/**
 * Mantém a tela ligada enquanto `active` (navegação em andamento). Usa a Wake Lock
 * API quando o navegador tem; o app Android também liga a tela pela própria casca.
 * O sistema solta o bloqueio ao esconder a página, então ele é pedido de novo ao voltar.
 */
export function useScreenWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return
    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    const acquire = async () => {
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (cancelled) {
          void lock.release()
          return
        }
        sentinel = lock
      } catch {
        // sem permissão ou bateria baixa: segue sem o bloqueio
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire()
    }

    void acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void sentinel?.release().catch(() => undefined)
    }
  }, [active])
}
