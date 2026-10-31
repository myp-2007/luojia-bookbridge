from fastapi import Header, HTTPException, status

from app.core.config import get_settings


def _dev_auth_enabled() -> bool:
    settings = get_settings()
    return settings.allow_dev_auth and settings.environment in {'development', 'test'}


def get_current_user_id(x_user_id: str | None = Header(default=None)) -> str:
    if _dev_auth_enabled() and x_user_id:
        return x_user_id
    if _dev_auth_enabled():
        return 'dev-user'
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='请先完成身份认证')


def require_admin(x_role: str | None = Header(default=None)) -> str:
    if _dev_auth_enabled() and x_role == 'admin':
        return 'admin'
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='需要管理员权限')
