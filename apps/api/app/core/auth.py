from datetime import datetime, timezone
from hashlib import sha256
from fastapi import Cookie, Depends, Header, HTTPException
from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.db.session import get_db
from app.models.user import User, UserSession


def demo_enabled() -> bool:
    settings = get_settings()
    return settings.allow_dev_auth and settings.environment in {'development', 'test'}


def token_hash(token: str) -> str:
    return sha256(token.encode()).hexdigest()


def get_current_user(
    bookbridge_session: str | None = Cookie(default=None),
    x_user_id: str | None = Header(default=None),
    x_role: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    if bookbridge_session:
        session = db.get(UserSession, token_hash(bookbridge_session))
        if session and session.expires_at.replace(tzinfo=timezone.utc) > datetime.now(timezone.utc):
            user = db.get(User, session.user_id)
            if user:
                return user
    if demo_enabled() and get_settings().allow_legacy_headers:
        return User(id=x_user_id or 'dev-user', nickname='兼容测试用户', role='admin' if x_role == 'admin' else 'student')
    raise HTTPException(401, '请先登录')


def get_current_user_id(user: User = Depends(get_current_user)) -> str:
    return user.id


def require_admin(user: User = Depends(get_current_user)) -> str:
    if user.role != 'admin':
        raise HTTPException(403, '需要管理员权限')
    return user.id
