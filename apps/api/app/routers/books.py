from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user_id
from app.db.session import get_db
from app.schemas.books import BookCreate, BookListResponse, BookRead
from app.services.books import create_book, get_book, list_books, publish_book, to_book_read

router = APIRouter(prefix='/books', tags=['books'])


@router.get('', response_model=BookListResponse)
def read_books(
    q: str | None = Query(default=None, max_length=100),
    category: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> BookListResponse:
    try:
        books, total = list_books(db, query=q, category=category, page=page, page_size=page_size)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    return BookListResponse(items=[to_book_read(book) for book in books], page=page, page_size=page_size, total=total)


@router.post('', response_model=BookRead, status_code=status.HTTP_201_CREATED)
def create_new_book(payload: BookCreate, db: Session = Depends(get_db), seller_id: str = Depends(get_current_user_id)) -> BookRead:
    try:
        return to_book_read(create_book(db, payload, seller_id))
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error


@router.get('/{book_id}', response_model=BookRead)
def read_book(book_id: UUID, db: Session = Depends(get_db)) -> BookRead:
    book = get_book(db, book_id)
    if book is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='书籍不存在')
    return to_book_read(book)


@router.post('/{book_id}/publish', response_model=BookRead)
def publish_existing_book(book_id: UUID, db: Session = Depends(get_db), seller_id: str = Depends(get_current_user_id)) -> BookRead:
    book = get_book(db, book_id)
    if book is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='书籍不存在')
    if book.seller_id != seller_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='只能发布自己的书籍')
    return to_book_read(publish_book(db, book))
