import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Single source of truth, shared with the backend (src/config.json).
const cfg = JSON.parse(readFileSync(new URL('../config.json', import.meta.url), 'utf8'))
const backend = `http://${cfg.backend.host}:${cfg.backend.port}`

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: cfg.frontend.port,
    proxy: { '/api': { target: backend, changeOrigin: true } },
  },
})
