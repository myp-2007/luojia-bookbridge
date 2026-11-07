from pathlib import Path
from io import BytesIO
import warnings
import logging
from datetime import datetime, timedelta, timezone
from PIL import Image, UnidentifiedImageError
from uuid import UUID, uuid4

from fastapi import UploadFile
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.book import Book, BookStatus
from app.models.book_image import BookImage
from app.models.ai_task import AITask
from app.schemas.images import BookImageRead

logger = logging.getLogger(__name__)

ALLOWED_CONTENT_TYPES = {'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp'}


async def save_book_image(db: Session, book: Book, file: UploadFile) -> BookImage:
    settings = get_settings()
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise ValueError('只支持 JPG、PNG 或 WebP 图片')
    content = await file.read(settings.max_upload_mb * 1024 * 1024 + 1)
    if len(content) > settings.max_upload_mb * 1024 * 1024:
        raise ValueError(f'图片不能超过 {settings.max_upload_mb}MB')

    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(BytesIO(content)) as decoded:
                if decoded.format not in {'PNG', 'JPEG', 'WEBP'}:
                    raise ValueError('文件格式与图片类型不符')
                actual_type = {'PNG': 'image/png', 'JPEG': 'image/jpeg', 'WEBP': 'image/webp'}[decoded.format]
                if actual_type != file.content_type:
                    raise ValueError('声明的图片类型与内容不符')
                if decoded.width * decoded.height > 20000000:
                    raise ValueError('图片像素过大')
                decoded.verify()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning) as error:
        raise ValueError('图片内容无效，请重新选择') from error
    locked = db.scalar(select(Book).where(Book.id == book.id).with_for_update().execution_options(populate_existing=True))
    if locked.is_suspended:
        raise ValueError('书籍受管理限制，请联系管理员核实')
    if locked.status not in {BookStatus.DRAFT, BookStatus.AVAILABLE, BookStatus.OFFLINE}:
        raise ValueError('预约中或已完成的书籍不能更换图片')
    ensure_images_idle(db, book.id)
    count = db.scalar(select(func.count()).select_from(BookImage).where(BookImage.book_id == book.id)) or 0
    if count >= 3:
        raise ValueError('每本书最多上传3张图片')
    image_id = uuid4()
    relative_path = Path(str(book.id)) / f'{image_id}{ALLOWED_CONTENT_TYPES[file.content_type]}'
    storage_root = Path(settings.storage_dir)
    target = storage_root / relative_path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(content)

    last_order = db.scalar(select(func.max(BookImage.sort_order)).where(BookImage.book_id == book.id))
    image = BookImage(id=image_id, book_id=book.id, storage_path=str(relative_path), original_name=file.filename or 'book-image', content_type=file.content_type, size_bytes=len(content), sort_order=(last_order + 1 if last_order is not None else 0))
    db.add(image)
    try:
        db.commit()
    except Exception:
        db.rollback()
        target.unlink(missing_ok=True)
        raise
    db.refresh(image)
    return image


def list_book_images(db: Session, book_id: UUID) -> list[BookImage]:
    return list(db.scalars(select(BookImage).where(BookImage.book_id == book_id).order_by(BookImage.sort_order, BookImage.created_at, BookImage.id)).all())


def to_image_read(image: BookImage) -> BookImageRead:
    return BookImageRead(id=image.id, book_id=image.book_id, original_name=image.original_name,
        content_type=image.content_type, size_bytes=image.size_bytes,
        url='/storage/' + image.storage_path.replace(chr(92), '/'), created_at=image.created_at)


def ensure_images_idle(db: Session, book_id: UUID) -> None:
    # Call while holding the book lock, shared with AI task creation.
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=90)
    active = db.scalar(select(AITask.id).where(AITask.book_id == book_id,
        AITask.status.in_(['queued', 'running']), AITask.created_at >= cutoff).limit(1))
    if active:
        from fastapi import HTTPException
        raise HTTPException(409, '识别任务进行中，请稍后管理图片')


def remove_image(db: Session, book_id: UUID, image_id: UUID) -> None:
    from fastapi import HTTPException
    image = db.get(BookImage, image_id)
    if not image or image.book_id != book_id:
        raise HTTPException(404, '图片不存在')
    ensure_images_idle(db, book_id)
    root = Path(get_settings().storage_dir).resolve()
    target = (root / image.storage_path).resolve()
    db.delete(image)
    db.commit()
    # Filesystem operations cannot share a DB transaction. Never delete before commit.
    if target.is_relative_to(root):
        try:
            target.unlink(missing_ok=True)
        except OSError:
            logger.warning('Could not remove detached book image %s', image_id)


def choose_cover(db: Session, book_id: UUID, image_id: UUID) -> list[BookImage]:
    from fastapi import HTTPException
    images = list_book_images(db, book_id)
    chosen = next((image for image in images if image.id == image_id), None)
    if not chosen:
        raise HTTPException(404, '图片不存在')
    ensure_images_idle(db, book_id)
    ordered = [chosen, *(image for image in images if image.id != image_id)]
    for index, image in enumerate(ordered):
        image.sort_order = index
    db.commit()
    return ordered
