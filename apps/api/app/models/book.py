from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Enum, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class BookCategory(StrEnum):
    TEXTBOOK = 'textbook'
    READING = 'reading'
    DONATION = 'donation'


class BookStatus(StrEnum):
    DRAFT = 'draft'
    AVAILABLE = 'available'
    RESERVED = 'reserved'
    COMPLETED = 'completed'
    OFFLINE = 'offline'


class Book(Base):
    __tablename__ = 'books'

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    seller_id: Mapped[str] = mapped_column(String(80), index=True)
    title: Mapped[str] = mapped_column(String(200), index=True)
    author: Mapped[str | None] = mapped_column(String(160), nullable=True)
    publisher: Mapped[str | None] = mapped_column(String(160), nullable=True)
    edition: Mapped[str | None] = mapped_column(String(80), nullable=True)
    price_cents: Mapped[int] = mapped_column(Integer, default=0)
    condition: Mapped[str] = mapped_column(String(40), default='待填写')
    has_notes: Mapped[bool] = mapped_column(default=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[BookCategory] = mapped_column(Enum(BookCategory), default=BookCategory.TEXTBOOK)
    status: Mapped[BookStatus] = mapped_column(Enum(BookStatus), default=BookStatus.DRAFT, index=True)
    pickup_point: Mapped[str | None] = mapped_column(String(120), nullable=True)
    ai_status: Mapped[str] = mapped_column(String(30), default='not_started')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
