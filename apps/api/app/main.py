from contextlib import asynccontextmanager
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import get_settings
from app.db.base import Base
from app.db.session import engine
from app.routers import ai, auth, books, health, reports, reservations

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.environment in {'development', 'test'} and settings.database_url.startswith('sqlite'):
        Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title=settings.app_name, version='0.2.0', lifespan=lifespan)
Path(settings.storage_dir).mkdir(parents=True, exist_ok=True)
app.mount('/storage', StaticFiles(directory=settings.storage_dir), name='storage')
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)
for router in [health.router, books.router, reservations.router, reports.router, auth.router, ai.router]:
    app.include_router(router, prefix='/api/v1')


@app.middleware('http')
async def request_id(request: Request, call_next):
    request.state.request_id = str(uuid4())
    origin = request.headers.get('origin')
    allowed = {str(request.base_url).rstrip('/'), *settings.cors_origin_list}
    if request.method in {'POST', 'PATCH', 'DELETE'} and request.cookies.get('bookbridge_session') and origin and origin not in allowed:
        return JSONResponse(status_code=403, content={
            'code': 'INVALID_ORIGIN', 'message': '请求来源不被允许',
            'details': {}, 'requestId': request.state.request_id,
        })
    response = await call_next(request)
    response.headers['X-Request-Id'] = request.state.request_id
    return response


@app.exception_handler(StarletteHTTPException)
async def http_error(request: Request, error: StarletteHTTPException):
    return JSONResponse(status_code=error.status_code, content={
        'code': f'HTTP_{error.status_code}', 'message': str(error.detail),
        'detail': error.detail, 'details': {},
        'requestId': getattr(request.state, 'request_id', ''),
    })


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, error: RequestValidationError):
    details = [{'loc': list(item['loc']), 'msg': item['msg'], 'type': item['type']} for item in error.errors()]
    return JSONResponse(status_code=422, content=jsonable_encoder({
        'code': 'VALIDATION_ERROR', 'message': '请检查输入字段',
        'detail': details, 'details': details,
        'requestId': getattr(request.state, 'request_id', ''),
    }))


# The local demonstration serves the built SPA and API from one origin.
web_dist = Path(__file__).resolve().parents[3] / 'apps' / 'web' / 'dist'
if web_dist.is_dir():
    app.mount('/', StaticFiles(directory=web_dist, html=True), name='web')
