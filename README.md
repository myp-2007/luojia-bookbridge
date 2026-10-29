# Luojia BookBridge

AI-assisted campus second-hand book trading and reuse platform.

珞珈书桥面向校园场景，帮助学生发布、查找、预约和线下交接二手书，并用 AI 辅助整理书籍信息和匹配课程需求。

## Current status

The repository now contains a runnable MVP foundation:

- React + Vite mobile-first book catalog.
- FastAPI REST API with OpenAPI documentation.
- PostgreSQL-ready SQLAlchemy models and Alembic migrations.
- Book creation, list, search, detail and publish endpoints.
- Local book image upload with type and size validation.
- Reservation creation, seller confirmation/rejection and buyer cancellation.
- “My reservations” frontend panel.
- Replaceable AI provider boundary with a deterministic MockProvider.
- Docker Compose setup for PostgreSQL and the API.
- Mock mode for frontend demos when the backend is unavailable.

The current product flow is:

```text
Authentication → Book listing → Search and matching → Reservation → Offline handover → Completion
```

## Stack

- Frontend: React, TypeScript, Vite, CSS modules in feature-oriented folders
- Backend: Python, FastAPI, SQLAlchemy, Alembic
- Database: PostgreSQL in deployment, SQLite for local tests
- Storage: local file volume first, object storage adapter later if needed
- AI: replaceable OCR/LLM provider interface with a local mock provider
- Deployment: Docker Compose and Caddy on one server

The project is a modular monolith. It intentionally does not require microservices, Kubernetes, a separate search cluster, a separate vector database or online payment for the first release.

## Run the frontend

```bash
cd apps/web
npm install
npm run dev
```

By default the frontend uses Mock data. To connect it to the local API, set:

```text
VITE_USE_API=true
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_DEV_USER_ID=demo-buyer
VITE_DEV_SELLER_ID=demo-seller
```

## Run the API locally

```bash
cd apps/api
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

API docs are available at `http://localhost:8000/docs`.

## Run API and PostgreSQL with Docker

From the repository root:

```bash
docker compose -f infra/docker-compose.yml up --build
```

The API container runs Alembic migrations before starting FastAPI. PostgreSQL data and uploaded images are stored in named Docker volumes.

## Repository layout

```text
apps/web/       React + Vite frontend
apps/api/       FastAPI backend, models, migrations and tests
infra/          Docker, reverse proxy, backup and deployment files
docs/api/       OpenAPI contract and API notes
seed/           Demo users, courses, books and pickup points
```

## Collaboration rules

- Read [AGENTS.md](AGENTS.md) before making changes with an AI coding assistant.
- Read [CONTRIBUTING.md](CONTRIBUTING.md) before creating a branch or pull request.
- Read [珞珈书桥技术架构方案.md](珞珈书桥技术架构方案.md) for the architecture baseline.
- Frontend changes belong under `apps/web`.
- Backend, database, AI and deployment changes belong under `apps/api`, `infra` and `seed`.
- `main` is the stable branch. Daily integration happens in `develop`.

## License

The project license will be selected before public release.
