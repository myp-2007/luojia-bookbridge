import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 45000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5174', browserName: 'chromium', channel: 'msedge',
    viewport: { width: 390, height: 844 }, screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: '..\\api\\.venv\\Scripts\\python.exe ..\\api\\tests\\start_api.py',
      url: 'http://127.0.0.1:8001/api/v1/health',
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5174 --strictPort',
      url: 'http://127.0.0.1:5174',
      env: { VITE_USE_API: 'true', VITE_API_BASE_URL: '/api/v1', BOOKBRIDGE_API_TARGET: 'http://127.0.0.1:8001' },
    },
  ],
})
