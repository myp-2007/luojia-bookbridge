from datetime import datetime
from uuid import UUID
from sqlalchemy import DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class BookFavorite(Base):
    __tablename__ = 'book_favorites'
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id'), primary_key=True)
    book_id: Mapped[UUID] = mapped_column(ForeignKey('books.id'), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
