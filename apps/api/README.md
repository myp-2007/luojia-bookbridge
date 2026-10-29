# API backend

This directory will contain the FastAPI modular monolith.

Ownership: Member B.

Business rules belong in services, database access belongs in repositories, and HTTP concerns belong in routers. Every database change must use an Alembic migration. Every public endpoint must be documented in `docs/api/openapi.yaml`.
