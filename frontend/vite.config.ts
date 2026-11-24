import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

const pkg = JSON.parse(readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf-8')) as {
  version?: string
}

const backendTarget = process.env.VITE_API_URL || 'http://127.0.0.1:8000'

const apiProxy = {
  '/api': {
    target: backendTarget,
    changeOrigin: true,
  },
  '/storage': {
    target: backendTarget,
    changeOrigin: true,
  },
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version || '2.5.0'),
  },
  server: { proxy: apiProxy, host: true, port: 5173 },
  preview: { proxy: apiProxy, host: true, port: 5173 },
})
