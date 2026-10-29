from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.book import Book, BookCategory, BookStatus
from app.schemas.books import BookCreate, BookRead


def to_book_read(book: Book) -> BookRead:
    return BookRead(
        id=book.id,
        seller_id=book.seller_id,
        title=book.title,
        author=book.author,
        publisher=book.publisher,
        edition=book.edition,
        price=book.price_cents / 100,
        condition=book.condition,
        has_notes=book.has_notes,
        description=book.description,
        category=book.category.value,
        status=book.status.value,
        pickup_point=book.pickup_point,
        ai_status=book.ai_status,
        created_at=book.created_at,
    )


def list_books(db: Session, *, query: str | None, category: str | None, page: int, page_size: int) -> tuple[list[Book], int]:
    filters = [Book.status.in_([BookStatus.AVAILABLE, BookStatus.RESERVED])]
    if category:
        filters.append(Book.category == BookCategory(category))
    if query:
        term = f'%{query.strip().lower()}%'
        filters.append(or_(func.lower(Book.title).like(term), func.lower(Book.author).like(term), func.lower(Book.publisher).like(term)))
    base_query = select(Book).where(*filters).order_by(Book.created_at.desc())
    total = db.scalar(select(func.count()).select_from(base_query.subquery())) or 0
    books = list(db.scalars(base_query.offset((page - 1) * page_size).limit(page_size)).all())
    return books, total


def create_book(db: Session, payload: BookCreate, seller_id: str) -> Book:
    try:
        category = BookCategory(payload.category)
    except ValueError as error:
        raise ValueError('不支持的书籍分类') from error
    book = Book(
        seller_id=seller_id,
        title=payload.title.strip(),
        author=payload.author,
        publisher=payload.publisher,
        edition=payload.edition,
        price_cents=round(payload.price * 100),
        condition=payload.condition,
        has_notes=payload.has_notes,
        description=payload.description,
        category=category,
        status=BookStatus.AVAILABLE,
        pickup_point=payload.pickup_point,
    )
    db.add(book)
    db.commit()
    db.refresh(book)
    return book


def get_book(db: Session, book_id: UUID) -> Book | None:
    return db.get(Book, book_id)


def publish_book(db: Session, book: Book) -> Book:
    if book.status != BookStatus.DRAFT:
        return book
    book.status = BookStatus.AVAILABLE
    db.commit()
    db.refresh(book)
    return book
