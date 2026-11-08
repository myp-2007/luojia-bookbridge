from datetime import datetime, timedelta, timezone
from hashlib import sha256
import secrets
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.core.auth import demo_enabled, get_current_user, token_hash
from app.core.dates import as_utc
from app.core.naming import to_camel
from app.core.passwords import hash_password, verify_password
from app.db.session import get_db
from app.models.user import AuthThrottle, User, UserSession
from app.schemas.books import APIModel

router = APIRouter(tags=['auth'])


class UserRead(APIModel):
    id: str
    username: str | None = None
    nickname: str
    role: Literal['student', 'admin']
    college: str
    contact: str | None
    gender: str = 'undisclosed'
    bio: str = ''
    avatar_url: str | None = None


class PublicUserRead(APIModel):
    id: str
    nickname: str
    college: str
    bio: str
    avatar_url: str | None


class DemoAccountRead(BaseModel):
    id: str
    nickname: str
    role: Literal['student', 'admin']


class Login(BaseModel):
    userId: str = Field(min_length=1, max_length=80)


class Credentials(BaseModel):
    model_config = ConfigDict(extra='forbid')
    username: str = Field(min_length=3, max_length=32, pattern=r'^[A-Za-z0-9_.-]+$')
    password: str = Field(min_length=8, max_length=128)

    @field_validator('username')
    @classmethod
    def normalize_username(cls, value):
        return value.lower()


class RegisterCreate(Credentials):
    nickname: str = Field(default='小珞', min_length=1, max_length=80)

    @field_validator('nickname')
    @classmethod
    def strip_nickname(cls, value):
        if not value.strip():
            raise ValueError('昵称不能为空')
        return value.strip()


class Profile(APIModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra='forbid')
    nickname: str | None = Field(default=None, min_length=1, max_length=80)
    contact: str | None = Field(default=None, max_length=200)
    college: str | None = Field(default=None, max_length=120)
    gender: Literal['undisclosed', 'male', 'female', 'other'] | None = None
    bio: str | None = Field(default=None, max_length=500)


class PasswordChange(APIModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


def user_read(user: User) -> dict:
    return dict(id=user.id, username=user.username, nickname=user.nickname, role=user.role,
        college=user.college, contact=user.contact, gender=user.gender or 'undisclosed',
        bio=user.bio or '', avatar_url='/storage/' + user.avatar_path.replace(chr(92), '/') if user.avatar_path else None)


def public_user_read(user: User) -> dict:
    own = user_read(user)
    return {key: own[key] for key in ['id', 'nickname', 'college', 'bio', 'avatar_url']}


def issue_session(db: Session, user: User, response: Response, previous: str | None):
    now = datetime.now(timezone.utc)
    db.execute(delete(UserSession).where(UserSession.expires_at <= now))
    if previous:
        db.execute(delete(UserSession).where(UserSession.token_hash == token_hash(previous)))
    token = secrets.token_urlsafe(32)
    db.add(UserSession(token_hash=token_hash(token), user_id=user.id, expires_at=now + timedelta(hours=8)))
    db.commit()
    response.set_cookie('bookbridge_session', token, httponly=True, samesite='lax', max_age=28800, secure=False)
    return user_read(user)


@router.post('/auth/register', response_model=UserRead, status_code=201)
def register(payload: RegisterCreate, request: Request, response: Response,
    bookbridge_session: str | None = Cookie(default=None), db: Session = Depends(get_db)):
    digest = hash_password(payload.password)
    if db.scalar(select(User.id).where(User.username == payload.username)):
        raise HTTPException(409, '这个账号已被使用，请换一个')
    local = request.client and request.client.host in {'127.0.0.1', '::1'}
    # SQLite serializes this bootstrap decision in the same transaction as the insert.
    if local and db.bind.dialect.name == 'postgresql':
        from sqlalchemy import text
        db.execute(text('SELECT pg_advisory_xact_lock(41955207)'))
    first_local_admin = local and not db.scalar(select(User.id).where(User.role == 'admin', User.password_hash.is_not(None)).limit(1))
    user = User(id=str(uuid4()), username=payload.username, password_hash=digest,
        nickname=payload.nickname, role='admin' if first_local_admin else 'student', college='', is_demo=False)
    db.add(user)
    try:
        db.flush()
        return issue_session(db, user, response, bookbridge_session)
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, '这个账号已被使用，请换一个')


@router.post('/auth/login', response_model=UserRead)
def password_login(payload: Credentials, request: Request, response: Response,
    bookbridge_session: str | None = Cookie(default=None), db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(minutes=15)
    db.execute(delete(AuthThrottle).where(AuthThrottle.window_started_at < cutoff))
    ip_key = sha256((request.client.host if request.client else 'unknown').encode()).hexdigest()
    throttle = db.get(AuthThrottle, ip_key)
    if throttle and throttle.failures >= 20:
        raise HTTPException(429, '尝试次数过多，请15分钟后再试')
    user = db.scalar(select(User).where(User.username == payload.username))
    if not verify_password(payload.password, user.password_hash if user else None):
        if not throttle:
            throttle = AuthThrottle(key=ip_key, failures=0, window_started_at=now)
            db.add(throttle)
        throttle.failures += 1
        db.commit()
        raise HTTPException(401, '账号或密码不正确')
    return issue_session(db, user, response, bookbridge_session)


@router.get('/auth/demo-accounts', response_model=list[DemoAccountRead])
def accounts(db: Session = Depends(get_db)):
    if not demo_enabled():
        raise HTTPException(404, '演示登录未开启')
    return [dict(id=u.id, nickname=u.nickname, role=u.role) for u in db.scalars(select(User).where(User.is_demo.is_(True))).all()]


@router.post('/auth/dev-login', response_model=UserRead)
def dev_login(payload: Login, response: Response, bookbridge_session: str | None = Cookie(default=None), db: Session = Depends(get_db)):
    if not demo_enabled():
        raise HTTPException(404, '演示登录未开启')
    user = db.get(User, payload.userId)
    if not user or not user.is_demo:
        raise HTTPException(403, '请选择已初始化的演示账号')
    return issue_session(db, user, response, bookbridge_session)


@router.post('/auth/logout')
def logout(response: Response, bookbridge_session: str | None = Cookie(default=None), db: Session = Depends(get_db)):
    if bookbridge_session:
        db.execute(delete(UserSession).where(UserSession.token_hash == token_hash(bookbridge_session)))
        db.commit()
    response.delete_cookie('bookbridge_session')
    return {'ok': True}


@router.post('/auth/password', status_code=204)
def change_password(payload: PasswordChange, response: Response, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(400, '当前密码不正确')
    user.password_hash = hash_password(payload.new_password)
    db.execute(delete(UserSession).where(UserSession.user_id == user.id))
    db.commit()
    response.delete_cookie('bookbridge_session')


@router.get('/me', response_model=UserRead)
def me(user: User = Depends(get_current_user)):
    return user_read(user)


@router.patch('/me', response_model=UserRead)
def update_me(payload: Profile, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    for key, value in payload.model_dump(exclude_unset=True).items():
        if key == 'nickname' and not (value or '').strip():
            raise HTTPException(422, '昵称不能为空')
        if key == 'gender' and value is None:
            raise HTTPException(422, '请选择性别或保密')
        if key in ['college', 'bio', 'nickname']:
            value = (value or '').strip()
        if key == 'contact':
            value = value.strip() or None if value else None
        setattr(user, key, value)
    db.commit()
    return user_read(user)
