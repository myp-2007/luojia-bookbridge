# Luojia BookBridge web frontend

This package is the mobile-first React + TypeScript + Vite frontend.

Ownership: frontend module.

The current foundation includes:

- responsive home page
- search input with quick tags
- textbook / reading / donation category tabs
- mock book cards and empty search state
- API client boundary at `src/lib/api-client.ts`
- typed book model at `src/types/books.ts`

Run locally:

```bash
npm install
npm run dev
```

The API base URL is configured with `VITE_API_BASE_URL`. The page currently uses mock data so it can be developed before the backend is ready.
