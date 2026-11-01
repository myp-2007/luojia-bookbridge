from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.book import Book
from app.models.book_image import BookImage

ALLOWED_CONTENT_TYPES = {'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp'}


async def save_book_image(db: Session, book: Book, file: UploadFile) -> BookImage:
    settings = get_settings()
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise ValueError('只支持 JPG、PNG 或 WebP 图片')
    content = await file.read(settings.max_upload_mb * 1024 * 1024 + 1)
    if len(content) > settings.max_upload_mb * 1024 * 1024:
        raise ValueError(f'图片不能超过 {settings.max_upload_mb}MB')

    image_id = uuid4()
    relative_path = Path(str(book.id)) / f'{image_id}{ALLOWED_CONTENT_TYPES[file.content_type]}'
    storage_root = Path(settings.storage_dir)
    target = storage_root / relative_path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(content)

    image = BookImage(id=image_id, book_id=book.id, storage_path=str(relative_path), original_name=file.filename or 'book-image', content_type=file.content_type, size_bytes=len(content))
    db.add(image)
    db.commit()
    db.refresh(image)
    return image


def list_book_images(db: Session, book_id) -> list[BookImage]:
    return list(db.scalars(select(BookImage).where(BookImage.book_id == book_id).order_by(BookImage.created_at, BookImage.id)).all())
