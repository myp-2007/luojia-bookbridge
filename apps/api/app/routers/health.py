from fastapi import APIRouter

router = APIRouter(tags=['health'])


@router.get('/health')
def health() -> dict[str, str]:
    return {'status': 'ok', 'service': 'luojia-bookbridge-api', 'version': '0.3.0', 'authentication': 'password'}
