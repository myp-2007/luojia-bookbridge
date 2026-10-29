from fastapi import Header, HTTPException, status

from app.core.config import get_settings


def get_current_user_id(x_user_id: str | None = Header(default=None)) -> str:
    settings = get_settings()
    if x_user_id:
        return x_user_id
    if settings.allow_dev_auth:
        return 'dev-user'
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='请先完成身份认证')
