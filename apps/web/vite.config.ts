import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: process.env.BOOKBRIDGE_API_TARGET ?? 'http://127.0.0.1:8000', changeOrigin: false },
      '/storage': { target: process.env.BOOKBRIDGE_API_TARGET ?? 'http://127.0.0.1:8000', changeOrigin: false },
    },
  },
})
