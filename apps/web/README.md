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

## Reservation workbench

Open “我的” to view purchases and sales. With `VITE_USE_API=true`, the panel uses the configured development buyer and seller identities and the existing reservation endpoints. Seller acceptance/rejection and both handover confirmations are available. With Mock mode, a clearly labelled sample reservation can be used to demonstrate the flow. Sample state resets when the panel closes.

Run browser regression checks with the locally installed Microsoft Edge:

```bash
npm ci
npm run test:e2e
```

The tests start a separate Vite server on port 5174 and intercept API requests. Screenshots are written under the ignored `test-results` directory.
