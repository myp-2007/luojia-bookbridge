from datetime import datetime, timedelta, timezone
import secrets
from typing import Literal
from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.orm import Session
from app.core.auth import demo_enabled, get_current_user, token_hash
from app.db.session import get_db
from app.models.user import User, UserSession

router = APIRouter(tags=['auth'])


class UserRead(BaseModel):
    id: str
    nickname: str
    role: Literal['student', 'admin']
    college: str
    contact: str | None


class DemoAccountRead(BaseModel):
    id: str
    nickname: str
    role: Literal['student', 'admin']


class Login(BaseModel):
    userId: str = Field(min_length=1, max_length=80)


class Profile(BaseModel):
    nickname: str = Field(min_length=1, max_length=80)
    contact: str | None = Field(default=None, max_length=200)


def user_read(user: User) -> dict:
    return dict(id=user.id, nickname=user.nickname, role=user.role, college=user.college, contact=user.contact)


@router.get('/auth/demo-accounts', response_model=list[DemoAccountRead])
def accounts(db: Session = Depends(get_db)) -> list[dict]:
    if not demo_enabled():
        raise HTTPException(404, '演示登录未开启')
    return [dict(id=u.id, nickname=u.nickname, role=u.role) for u in db.scalars(select(User).where(User.is_demo.is_(True))).all()]


@router.post('/auth/dev-login', response_model=UserRead)
def login(payload: Login, response: Response, bookbridge_session: str | None = Cookie(default=None), db: Session = Depends(get_db)) -> dict:
    if not demo_enabled():
        raise HTTPException(404, '演示登录未开启')
    user = db.get(User, payload.userId)
    if not user or not user.is_demo:
        raise HTTPException(403, '请选择已初始化的演示账号')
    now = datetime.now(timezone.utc)
    db.execute(delete(UserSession).where(UserSession.expires_at <= now))
    if bookbridge_session:
        db.execute(delete(UserSession).where(UserSession.token_hash == token_hash(bookbridge_session)))
    token = secrets.token_urlsafe(32)
    db.add(UserSession(token_hash=token_hash(token), user_id=user.id, expires_at=now + timedelta(hours=8)))
    db.commit()
    response.set_cookie('bookbridge_session', token, httponly=True, samesite='lax', max_age=28800, secure=False)
    return user_read(user)


@router.post('/auth/logout')
def logout(response: Response, bookbridge_session: str | None = Cookie(default=None), db: Session = Depends(get_db)) -> dict:
    if bookbridge_session:
        db.execute(delete(UserSession).where(UserSession.token_hash == token_hash(bookbridge_session)))
        db.commit()
    response.delete_cookie('bookbridge_session')
    return {'ok': True}


@router.get('/me', response_model=UserRead)
def me(user: User = Depends(get_current_user)) -> dict:
    return user_read(user)


@router.patch('/me', response_model=UserRead)
def update_me(payload: Profile, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    if not payload.nickname.strip():
        raise HTTPException(422, '昵称不能为空')
    user.nickname = payload.nickname.strip()
    user.contact = payload.contact.strip() if payload.contact else None
    db.commit()
    return user_read(user)
