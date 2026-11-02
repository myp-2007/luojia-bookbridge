from pathlib import Path
from io import BytesIO
import warnings
from PIL import Image, UnidentifiedImageError
from uuid import UUID, uuid4

from fastapi import UploadFile
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.book import Book, BookStatus
from app.models.book_image import BookImage

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
    if locked.status not in {BookStatus.DRAFT, BookStatus.AVAILABLE, BookStatus.OFFLINE}:
        raise ValueError('预约中或已完成的书籍不能更换图片')
    count = db.scalar(select(func.count()).select_from(BookImage).where(BookImage.book_id == book.id)) or 0
    if count >= 3:
        raise ValueError('每本书最多上传3张图片')
    image_id = uuid4()
    relative_path = Path(str(book.id)) / f'{image_id}{ALLOWED_CONTENT_TYPES[file.content_type]}'
    storage_root = Path(settings.storage_dir)
    target = storage_root / relative_path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(content)

    image = BookImage(id=image_id, book_id=book.id, storage_path=str(relative_path), original_name=file.filename or 'book-image', content_type=file.content_type, size_bytes=len(content))
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
    return list(db.scalars(select(BookImage).where(BookImage.book_id == book_id).order_by(BookImage.created_at, BookImage.id)).all())
