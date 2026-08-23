import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
    // Evita que o Vite resolva o junction "GPSScooter" (sem espaço, usado por
    // .claude/launch.json para contornar limitações de parsing de comando)
    // de volta ao caminho real "GPS Scooter" (com espaço), o que quebrava a
    // checagem de allowlist do dev server.
    preserveSymlinks: true,
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
})
