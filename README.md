# Luojia BookBridge

AI-assisted campus second-hand book trading and reuse platform.

珞珈书桥面向校园场景，帮助学生发布、查找、预约和线下交接二手书，并用 AI 辅助整理书籍信息和匹配课程需求。

## Project status

This repository is currently in the architecture and engineering setup phase. The first release will focus on a stable textbook trading flow:

```text
Authentication → Book listing → Search and matching → Reservation → Offline handover → Completion
```

## Planned stack

- Frontend: React, TypeScript, Vite, React Router, Tailwind CSS
- Backend: Python, FastAPI, SQLAlchemy, Alembic
- Database: PostgreSQL
- Deployment: Docker Compose and Caddy on one server
- AI: replaceable OCR/LLM providers with a local mock provider for development
- Storage: local file volume first, object storage adapter later if needed

The project intentionally starts as a modular monolith. It does not require microservices, Kubernetes, a separate search cluster, a separate vector database, or online payment in the first release.

## Repository layout

```text
apps/web/       React + Vite frontend
apps/api/       FastAPI backend
infra/          Docker, reverse proxy, backup and deployment files
docs/api/       OpenAPI contract and API notes
seed/           Demo users, courses, books and pickup points
```

## Collaboration rules

- Read [AGENTS.md](AGENTS.md) before making changes with an AI coding assistant.
- Read [CONTRIBUTING.md](CONTRIBUTING.md) before creating a branch or pull request.
- Read [珞珈书桥技术架构方案.md](珞珈书桥技术架构方案.md) for the architecture baseline.
- Member A owns the frontend under `apps/web`.
- Member B owns the backend, database, AI and deployment under `apps/api`, `infra` and `seed`.
- `main` is the stable branch. Daily integration happens in `develop`.

## First development milestone

1. Create the frontend and backend skeleton.
2. Start PostgreSQL through Docker Compose.
3. Add test authentication.
4. Implement book creation, image upload, list, detail and search.
5. Define and publish the first version of the OpenAPI contract.

## License

The project license will be selected before public release.
