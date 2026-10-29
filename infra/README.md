# Infrastructure

This directory contains Docker Compose, Caddy, environment examples, backup scripts and deployment notes.

The first backend deployment target is one server running FastAPI and PostgreSQL. Start it from the repository root with:

```bash
docker compose -f infra/docker-compose.yml up --build
```

The API container runs Alembic migrations before starting FastAPI.
