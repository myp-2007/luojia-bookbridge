import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://127.0.0.1:5174',
    browserName: 'chromium',
    channel: 'msedge',
    viewport: { width: 390, height: 844 },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5174 --strictPort',
    url: 'http://127.0.0.1:5174',
    env: { VITE_USE_API: 'true', VITE_API_BASE_URL: 'http://localhost:8000/api/v1', VITE_DEV_USER_ID: 'demo-buyer', VITE_DEV_SELLER_ID: 'demo-seller' },
  },
})
