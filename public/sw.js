// Service worker mínimo — existe apenas para satisfazer os critérios de
// instalabilidade de PWA do Chrome/Android ("Adicionar à tela inicial").
// Não implementa cache offline nesta fase, para evitar complexidade de
// invalidação de cache durante o desenvolvimento ativo do app.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
