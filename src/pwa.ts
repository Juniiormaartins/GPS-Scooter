/**
 * Registro do service worker mínimo (public/sw.js) — necessário para o
 * Chrome/Android considerar o app instalável como PWA. No iOS Safari não é
 * necessário (o "Adicionar à Tela de Início" funciona só com o manifest +
 * apple-touch-icon), mas registrar não atrapalha.
 */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Falha ao registrar não deve impedir o app de funcionar normalmente.
    })
  })
}
