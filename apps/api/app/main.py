from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.db.base import Base
from app.db.session import engine
from app.models import book, pickup_point, reservation  # noqa: F401
from app.routers import books, health, reservations

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.environment in {'development', 'test'} and settings.database_url.startswith('sqlite'):
        Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title=settings.app_name, version='0.1.0', lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origin_list, allow_credentials=True, allow_methods=['*'], allow_headers=['*'])
app.include_router(health.router, prefix='/api/v1')
app.include_router(books.router, prefix='/api/v1')
app.include_router(reservations.router, prefix='/api/v1')
