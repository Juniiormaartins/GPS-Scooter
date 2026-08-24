import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
    /**
     * Só em desenvolvimento local. Existe para o Vite não resolver o junction
     * "GPSScooter" (sem espaço, usado por .claude/launch.json) de volta ao
     * caminho real "GPS Scooter" (com espaço), o que quebrava a allowlist do
     * dev server.
     *
     * Fora do dev isso é desligado de propósito: em build de CI (Vercel), com
     * gerenciadores que usam symlink em node_modules (pnpm/yarn), manter
     * `preserveSymlinks` pode quebrar a resolução de dependências. O problema
     * que ele resolve é exclusivamente local.
     */
    preserveSymlinks: command === 'serve',
  },
  server: {
    host: true,
    // Permite acesso via túnel de desenvolvimento HTTPS (localtunnel) para
    // testar geolocalização real no celular — Safari/iOS só concede acesso
    // ao GPS em origens seguras (HTTPS) ou localhost, daí a necessidade do
    // túnel para testes fora do desktop. Sem isso, o Vite rejeita qualquer
    // Host header que não seja localhost/IP local (proteção padrão do Vite).
    allowedHosts: ['.loca.lt', '.trycloudflare.com'],
  },
  preview: {
    host: true,
    allowedHosts: ['.loca.lt', '.trycloudflare.com'],
  },
}))
