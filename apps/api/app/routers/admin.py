from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import Field, field_validator
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.auth import require_admin
from app.db.session import get_db
from app.models.book import Book, BookStatus
from app.models.user import AuditLog
from app.schemas.books import APIModel, BookListResponse, BookRead
from app.services.books import to_book_read

router = APIRouter(prefix='/admin/books', tags=['admin'])


class ModerationCreate(APIModel):
    suspended: bool
    reason: str = Field(min_length=1, max_length=500)

    @field_validator('reason')
    @classmethod
    def strip_reason(cls, value: str) -> str:
        if not value.strip():
            raise ValueError('请填写处理说明')
        return value.strip()


@router.get('', response_model=BookListResponse)
def read_books(q: str = Query('', max_length=100), suspended: bool | None = None,
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db), _: str = Depends(require_admin)) -> BookListResponse:
    statement = select(Book)
    if q.strip():
        term = q.strip().lower()
        statement = statement.where(or_(*(func.lower(field).contains(term, autoescape=True)
            for field in [Book.title, Book.author, Book.seller_id])))
    if suspended is not None:
        statement = statement.where(Book.is_suspended.is_(suspended))
    total = db.scalar(select(func.count()).select_from(statement.subquery())) or 0
    items = db.scalars(statement.order_by(Book.created_at.desc(), Book.id.desc())
        .offset((page - 1) * page_size).limit(page_size)).all()
    return BookListResponse(items=[to_book_read(book) for book in items], page=page, page_size=page_size, total=total)


@router.post('/{book_id}/moderation', response_model=BookRead)
def moderate(book_id: UUID, payload: ModerationCreate, db: Session = Depends(get_db),
    admin_id: str = Depends(require_admin)) -> BookRead:
    book = db.scalar(select(Book).where(Book.id == book_id).with_for_update().execution_options(populate_existing=True))
    if not book:
        raise HTTPException(404, '书籍不存在')
    book.is_suspended = payload.suspended
    book.moderation_reason = payload.reason
    if payload.suspended and book.status in {BookStatus.AVAILABLE, BookStatus.DRAFT}:
        book.status = BookStatus.OFFLINE
    db.add(AuditLog(actor_id=admin_id, action='suspend_book' if payload.suspended else 'restore_book',
        target_id=str(book_id), description=payload.reason))
    db.commit()
    return to_book_read(book)
