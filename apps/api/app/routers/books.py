from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.models.book import Book, BookStatus, BookCategory

from app.core.auth import get_current_user_id
from app.db.session import get_db
from app.providers.book_recognition import MockBookRecognitionProvider
from app.schemas.ai import BookRecognitionRead, RecognitionFieldRead
from app.schemas.books import BookCreate, BookListResponse, BookRead
from app.schemas.images import BookImageRead
from app.services.books import create_book, get_book, list_books, publish_book, to_book_read
from app.services.images import list_book_images, save_book_image

router = APIRouter(prefix='/books', tags=['books'])


@router.get('', response_model=BookListResponse)
def read_books(
    q: str | None = Query(default=None, max_length=100),
    category: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    min_price_cents: int | None = Query(default=None, ge=0, le=10000000),
    max_price_cents: int | None = Query(default=None, ge=0, le=10000000),
    condition: str | None = Query(default=None, max_length=40),
    has_notes: bool | None = None,
    available_only: bool = False,
    sort: Literal['relevance', 'newest', 'price_asc', 'price_desc'] = 'relevance',
    db: Session = Depends(get_db),
) -> BookListResponse:
    try:
        books, total = list_books(
            db, query=q, category=category, page=page, page_size=page_size,
            min_price_cents=min_price_cents, max_price_cents=max_price_cents,
            condition=condition, has_notes=has_notes, available_only=available_only, sort=sort,
        )
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    return BookListResponse(items=[to_book_read(book) for book in books], page=page, page_size=page_size, total=total)


@router.post('', response_model=BookRead, status_code=status.HTTP_201_CREATED)
def create_new_book(payload: BookCreate, db: Session = Depends(get_db), seller_id: str = Depends(get_current_user_id)) -> BookRead:
    try:
        return to_book_read(create_book(db, payload, seller_id))
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error


@router.get('/mine', response_model=BookListResponse)
def mine(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), db: Session = Depends(get_db), user_id: str = Depends(get_current_user_id)) -> BookListResponse:
    statement = select(Book).where(Book.seller_id == user_id)
    total = db.scalar(select(func.count()).select_from(statement.subquery())) or 0
    items = db.scalars(statement.order_by(Book.created_at.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return BookListResponse(items=[to_book_read(book) for book in items], page=page, page_size=page_size, total=total)


def editable_book(db: Session, book_id: UUID, actor_id: str) -> Book:
    book = db.scalar(select(Book).where(Book.id == book_id).with_for_update().execution_options(populate_existing=True))
    if not book:
        raise HTTPException(404, '书籍不存在')
    if book.seller_id != actor_id:
        raise HTTPException(403, '只能管理自己的书籍')
    if book.status not in {BookStatus.DRAFT, BookStatus.AVAILABLE, BookStatus.OFFLINE}:
        raise HTTPException(409, '预约中或已完成的书籍不能修改')
    return book


@router.patch('/{book_id}', response_model=BookRead)
def edit(book_id: UUID, payload: BookCreate, db: Session = Depends(get_db), user_id: str = Depends(get_current_user_id)) -> BookRead:
    book = editable_book(db, book_id, user_id)
    try:
        book.category = BookCategory(payload.category)
    except ValueError:
        raise HTTPException(422, '不支持的书籍分类')
    for name in ['title', 'author', 'publisher', 'edition', 'condition', 'has_notes', 'description', 'pickup_point']:
        setattr(book, name, getattr(payload, name))
    book.price_cents = payload.price_cents if payload.price_cents is not None else round(payload.price * 100)
    db.commit()
    return to_book_read(book)


@router.post('/{book_id}/offline', response_model=BookRead)
def offline(book_id: UUID, db: Session = Depends(get_db), user_id: str = Depends(get_current_user_id)) -> BookRead:
    book = editable_book(db, book_id, user_id)
    book.status = BookStatus.OFFLINE
    db.commit()
    return to_book_read(book)


@router.get('/{book_id}', response_model=BookRead)
def read_book(book_id: UUID, db: Session = Depends(get_db)) -> BookRead:
    book = get_book(db, book_id)
    if book is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='书籍不存在')
    return to_book_read(book)


@router.get('/{book_id}/images', response_model=list[BookImageRead])
def read_book_images(book_id: UUID, db: Session = Depends(get_db)) -> list[BookImageRead]:
    book = get_book(db, book_id)
    if book is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='书籍不存在')
    return [
        BookImageRead(
            id=image.id,
            book_id=image.book_id,
            original_name=image.original_name,
            content_type=image.content_type,
            size_bytes=image.size_bytes,
            url=f'/storage/{image.storage_path.replace(chr(92), chr(47))}',
            created_at=image.created_at,
        )
        for image in list_book_images(db, book_id)
    ]


@router.post('/{book_id}/publish', response_model=BookRead)
def publish_existing_book(book_id: UUID, db: Session = Depends(get_db), seller_id: str = Depends(get_current_user_id)) -> BookRead:
    book = get_book(db, book_id)
    if book is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='书籍不存在')
    if book.seller_id != seller_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='只能发布自己的书籍')
    book = editable_book(db, book_id, seller_id)
    return to_book_read(publish_book(db, book))


@router.post('/{book_id}/images', response_model=BookImageRead, status_code=status.HTTP_201_CREATED)
async def upload_book_image(book_id: UUID, file: UploadFile = File(...), db: Session = Depends(get_db), seller_id: str = Depends(get_current_user_id)) -> BookImageRead:
    book = get_book(db, book_id)
    if book is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='书籍不存在')
    if book.seller_id != seller_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='只能为自己发布的书籍上传图片')
    try:
        image = await save_book_image(db, book, file)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    return BookImageRead(id=image.id, book_id=image.book_id, original_name=image.original_name, content_type=image.content_type, size_bytes=image.size_bytes, url=f'/storage/{image.storage_path.replace(chr(92), chr(47))}', created_at=image.created_at)


@router.post('/{book_id}/ai-extract', response_model=BookRecognitionRead)
def recognize_book(book_id: UUID, db: Session = Depends(get_db), seller_id: str = Depends(get_current_user_id)) -> BookRecognitionRead:
    book = get_book(db, book_id)
    if book is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='书籍不存在')
    if book.seller_id != seller_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='只能识别自己发布的书籍')
    result = MockBookRecognitionProvider().recognize(book)
    book.ai_status = 'succeeded'
    db.commit()
    return BookRecognitionRead(
        title=RecognitionFieldRead(value=result.title.value, confidence=result.title.confidence),
        author=RecognitionFieldRead(value=result.author.value, confidence=result.author.confidence),
        publisher=RecognitionFieldRead(value=result.publisher.value, confidence=result.publisher.confidence),
        edition=RecognitionFieldRead(value=result.edition.value, confidence=result.edition.confidence),
        warnings=result.warnings,
        provider='mock',
    )
