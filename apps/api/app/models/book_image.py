from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class BookImage(Base):
    __tablename__ = 'book_images'

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    book_id: Mapped[UUID] = mapped_column(ForeignKey('books.id'), index=True)
    storage_path: Mapped[str] = mapped_column(String(500))
    original_name: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(80))
    size_bytes: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
