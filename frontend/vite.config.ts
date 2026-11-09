import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

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
  server: { proxy: apiProxy, host: true, port: 5173 },
  preview: { proxy: apiProxy, host: true, port: 5173 },
})
