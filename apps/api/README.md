# Luojia BookBridge API backend

This directory contains the FastAPI modular monolith.

Current foundation:

- health endpoint at `/api/v1/health`
- book create, list, search and detail endpoints
- development identity through the `X-User-Id` header
- reservation creation with one-active-reservation protection
- SQLite for local development and PostgreSQL-compatible SQLAlchemy models
- API tests for health, book search and reservation concurrency rules

Run locally from this directory:

```bash
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

OpenAPI documentation is available at `http://localhost:8000/docs` while the server is running. Database schema changes must use Alembic migrations before production deployment.
