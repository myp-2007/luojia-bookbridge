from uuid import UUID
from fastapi import HTTPException

from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session, object_session
from app.models.book_image import BookImage

from app.models.book import Book, BookCategory, BookStatus
from app.schemas.books import BookCreate, BookRead


def to_book_read(book: Book) -> BookRead:
    db = object_session(book)
    cover = db.scalar(select(BookImage).where(BookImage.book_id == book.id).order_by(BookImage.sort_order, BookImage.created_at, BookImage.id).limit(1)) if db else None
    cover_url = '/storage/' + cover.storage_path.replace(chr(92), '/') if cover else None
    return BookRead(
        id=book.id,
        seller_id=book.seller_id,
        title=book.title,
        author=book.author,
        publisher=book.publisher,
        edition=book.edition,
        price=book.price_cents / 100,
        price_cents=book.price_cents,
        condition=book.condition,
        has_notes=book.has_notes,
        description=book.description,
        category=book.category.value,
        status=book.status.value,
        pickup_point=book.pickup_point,
        ai_status=book.ai_status,
        cover_url=cover_url,
        is_suspended=book.is_suspended,
        moderation_reason=book.moderation_reason,
        created_at=book.created_at,
    )


def list_books(
    db: Session, *, query: str | None, category: str | None, page: int, page_size: int,
    min_price_cents: int | None = None, max_price_cents: int | None = None,
    condition: str | None = None, has_notes: bool | None = None,
    available_only: bool = False, sort: str = 'relevance',
) -> tuple[list[Book], int]:
    if min_price_cents is not None and max_price_cents is not None and min_price_cents > max_price_cents:
        raise ValueError('最低价不能高于最高价')

    from app.services.reservations import expire_pending
    expire_pending(db)
    statuses = [BookStatus.AVAILABLE] if available_only else [BookStatus.AVAILABLE, BookStatus.RESERVED]
    filters = [Book.status.in_(statuses), Book.is_suspended.is_(False)]
    if category:
        filters.append(Book.category == BookCategory(category))
    if min_price_cents is not None:
        filters.append(Book.price_cents >= min_price_cents)
    if max_price_cents is not None:
        filters.append(Book.price_cents <= max_price_cents)
    if condition:
        filters.append(Book.condition == condition)
    if has_notes is not None:
        filters.append(Book.has_notes.is_(has_notes))

    phrase = ' '.join((query or '').lower().split())
    title = func.lower(Book.title)
    searchable = [title, func.lower(Book.author), func.lower(Book.publisher), func.lower(Book.edition)]
    for term in dict.fromkeys(phrase.split()):
        filters.append(or_(*(field.contains(term, autoescape=True) for field in searchable)))

    order = []
    if sort == 'price_asc':
        order.append(Book.price_cents.asc())
    elif sort == 'price_desc':
        order.append(Book.price_cents.desc())
    elif sort == 'relevance' and phrase:
        order.append(case(
            (title == phrase, 0),
            (title.startswith(phrase, autoescape=True), 1),
            (title.contains(phrase, autoescape=True), 2),
            else_=3,
        ))
    base_query = select(Book).where(*filters)
    total = db.scalar(select(func.count()).select_from(base_query.subquery())) or 0
    results = base_query.order_by(*order, Book.created_at.desc(), Book.id.desc())
    books = list(db.scalars(results.offset((page - 1) * page_size).limit(page_size)).all())
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
        price_cents=payload.price_cents if payload.price_cents is not None else round(payload.price * 100),
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
    if book.is_suspended:
        raise ValueError('书籍受管理限制，请联系管理员核实')
    if book.status == BookStatus.AVAILABLE:
        return book
    if book.status not in {BookStatus.DRAFT, BookStatus.OFFLINE}:
        raise ValueError('预约中或已完成的书籍不能重新发布')
    book.status = BookStatus.AVAILABLE
    db.commit()
    db.refresh(book)
    return book


def editable_book(db: Session, book_id: UUID, actor_id: str) -> Book:
    book = db.scalar(select(Book).where(Book.id == book_id).with_for_update().execution_options(populate_existing=True))
    if not book:
        raise HTTPException(404, '书籍不存在')
    if book.seller_id != actor_id:
        raise HTTPException(403, '只能管理自己的书籍')
    if book.is_suspended:
        raise HTTPException(409, '书籍受管理限制，请联系管理员核实')
    if book.status not in {BookStatus.DRAFT, BookStatus.AVAILABLE, BookStatus.OFFLINE}:
        raise HTTPException(409, '预约中或已完成的书籍不能修改')
    return book
