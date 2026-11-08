from io import BytesIO
import logging
from pathlib import Path
import warnings
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy import delete, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, get_optional_user
from app.core.config import get_settings
from app.db.session import get_db
from app.models.book import Book, BookCategory, BookStatus
from app.models.favorite import BookFavorite
from app.models.reservation import Reservation, ReservationStatus
from app.models.user import User
from app.routers.auth import PublicUserRead, UserRead, public_user_read, user_read
from app.schemas.books import BookListResponse
from app.services.books import to_book_read

router = APIRouter(tags=['profiles'])
logger = logging.getLogger(__name__)


def remove_avatar_file(relative: str | None):
    if not relative:
        return
    root = Path(get_settings().storage_dir).resolve()
    target = (root / relative).resolve()
    if target.is_relative_to(root):
        try:
            target.unlink(missing_ok=True)
        except OSError:
            logger.warning('Could not remove detached avatar file')


@router.post('/me/avatar', response_model=UserRead)
async def upload_avatar(file: UploadFile = File(...), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if file.content_type not in {'image/jpeg', 'image/png', 'image/webp'}:
        raise HTTPException(400, '头像只支持JPG、PNG或WebP')
    content = await file.read(2 * 1024 * 1024 + 1)
    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(400, '头像不能超过2MB')
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(BytesIO(content)) as source:
                types = {'JPEG': 'image/jpeg', 'PNG': 'image/png', 'WEBP': 'image/webp'}
                if types.get(source.format) != file.content_type or source.width * source.height > 20000000:
                    raise HTTPException(400, '头像内容无效或像素过大')
                source.load()
                image = ImageOps.exif_transpose(source).convert('RGB')
                image = ImageOps.fit(image, (512, 512), method=Image.Resampling.LANCZOS)
                output = BytesIO()
                image.save(output, 'JPEG', quality=88)
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise HTTPException(400, '头像内容无效，请重新选择')
    relative = 'avatars/' + str(uuid4()) + '.jpg'
    target = Path(get_settings().storage_dir) / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(output.getvalue())
    # Serialize concurrent uploads against the current user, not an earlier session snapshot.
    current = db.scalar(select(User).where(User.id == user.id).with_for_update().execution_options(populate_existing=True))
    previous = current.avatar_path
    current.avatar_path = relative
    try:
        db.commit()
    except Exception:
        db.rollback()
        target.unlink(missing_ok=True)
        raise
    result = user_read(current)
    remove_avatar_file(previous)
    return result


@router.delete('/me/avatar', status_code=204)
def delete_avatar(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    current = db.scalar(select(User).where(User.id == user.id).with_for_update().execution_options(populate_existing=True))
    previous = current.avatar_path
    current.avatar_path = None
    db.commit()
    remove_avatar_file(previous)


@router.get('/me/stats')
def stats(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    owned = Book.seller_id == user.id
    participant = or_(Reservation.buyer_id == user.id, owned)
    trades = select(Reservation).join(Book, Book.id == Reservation.book_id).where(participant)
    def count(statement):
        return db.scalar(select(func.count()).select_from(statement.subquery())) or 0
    return dict(published=count(select(Book.id).where(owned)),
        reservations=count(trades.where(Reservation.buyer_id == user.id, Reservation.status.in_([ReservationStatus.PENDING, ReservationStatus.CONFIRMED, ReservationStatus.DISPUTED]))),
        completed=count(trades.where(Reservation.status == ReservationStatus.COMPLETED)),
        gifts=count(select(Book.id).where(owned, Book.category == BookCategory.DONATION, Book.status == BookStatus.COMPLETED)))


@router.get('/users/{user_id}', response_model=PublicUserRead)
def public_profile(user_id: str, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, '用户不存在')
    return public_user_read(user)


def paginated_books(db, statement, page, page_size, user_id):
    total = db.scalar(select(func.count()).select_from(statement.subquery())) or 0
    books = db.scalars(statement.order_by(Book.created_at.desc(), Book.id.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return BookListResponse(items=[to_book_read(book, user_id) for book in books], page=page, page_size=page_size, total=total)


@router.get('/users/{user_id}/books', response_model=BookListResponse)
def public_books(user_id: str, page: int = Query(1, ge=1), page_size: int = Query(12, ge=1, le=100), db: Session = Depends(get_db), viewer: User | None = Depends(get_optional_user)):
    if not db.get(User, user_id):
        raise HTTPException(404, '用户不存在')
    query = select(Book).where(Book.seller_id == user_id, Book.status.in_([BookStatus.AVAILABLE, BookStatus.RESERVED]), Book.is_suspended.is_(False))
    return paginated_books(db, query, page, page_size, viewer.id if viewer else None)


@router.get('/me/favorites', response_model=BookListResponse)
def favorites(page: int = Query(1, ge=1), page_size: int = Query(12, ge=1, le=100), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = select(Book).join(BookFavorite, Book.id == BookFavorite.book_id).where(BookFavorite.user_id == user.id)
    return paginated_books(db, query, page, page_size, user.id)


@router.post('/books/{book_id}/favorite', status_code=204)
def favorite(book_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not db.get(Book, book_id):
        raise HTTPException(404, '书籍不存在')
    if not db.get(BookFavorite, (user.id, book_id)):
        db.add(BookFavorite(user_id=user.id, book_id=book_id))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()


@router.delete('/books/{book_id}/favorite', status_code=204)
def unfavorite(book_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.execute(delete(BookFavorite).where(BookFavorite.user_id == user.id, BookFavorite.book_id == book_id))
    db.commit()
