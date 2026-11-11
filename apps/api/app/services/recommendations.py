from heapq import nsmallest
from math import asin, cos, radians, sin, sqrt

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.book import Book, BookStatus
from app.models.user import User
from app.schemas.maps import Coordinates
from app.schemas.recommendations import RecommendationItem, RecommendationQuery, RecommendationResult
from app.services.books import book_search_filters, normalize_book_query, to_book_read
from app.services.reservations import expire_pending


def distance_meters(origin: Coordinates, latitude: float, longitude: float) -> float:
    start, end = radians(origin.latitude), radians(latitude)
    half_latitude = (end - start) / 2
    half_longitude = radians(longitude - origin.longitude) / 2
    arc = sin(half_latitude) ** 2 + cos(start) * cos(end) * sin(half_longitude) ** 2
    return 2 * 6_371_000 * asin(sqrt(min(1, arc)))


def recommend_books(
    db: Session, payload: RecommendationQuery, user_id: str, ai_keywords: list[str] | None,
) -> RecommendationResult:
    keywords = ai_keywords or [payload.query]
    phrase = normalize_book_query(' '.join(keywords))
    expire_pending(db)
    matches = select(Book).join(User, User.id == Book.seller_id).where(
        Book.status == BookStatus.AVAILABLE,
        Book.is_suspended.is_(False),
        Book.seller_id != user_id,
        User.password_hash.is_not(None),
        *book_search_filters(phrase),
    )

    origin = payload.origin
    unlocated_count = 0
    if payload.sort == 'distance' and origin is not None:
        missing = or_(Book.pickup_latitude.is_(None), Book.pickup_longitude.is_(None))
        unlocated_count = db.scalar(select(func.count()).select_from(matches.where(missing).subquery())) or 0
        candidates = db.scalars(matches.where(~missing).execution_options(yield_per=100))
        ranked = nsmallest(
            12,
            ((distance_meters(origin, book.pickup_latitude, book.pickup_longitude), book) for book in candidates),
            key=lambda item: (item[0], item[1].price_cents, item[1].id),
        )
        items = [RecommendationItem(book=to_book_read(book, user_id), distance_meters=round(distance)) for distance, book in ranked]
    else:
        books = db.scalars(matches.order_by(Book.price_cents, Book.created_at.desc(), Book.id).limit(12)).all()
        items = [RecommendationItem(book=to_book_read(book, user_id), distance_meters=None) for book in books]
    return RecommendationResult(
        items=items, keywords=keywords, source='deepseek' if ai_keywords else 'keyword', unlocated_count=unlocated_count,
    )
