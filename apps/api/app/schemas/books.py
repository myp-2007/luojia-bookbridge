from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.naming import to_camel
from app.models.book import BookStatus, BookCategory


class APIModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class BookCreate(APIModel):
    title: str = Field(min_length=1, max_length=200)
    author: str | None = Field(default=None, max_length=160)
    publisher: str | None = Field(default=None, max_length=160)
    edition: str | None = Field(default=None, max_length=80)
    price: float = Field(default=0, ge=0, le=100000, allow_inf_nan=False)
    price_cents: int | None = Field(default=None, ge=0, le=10000000)
    condition: str = Field(default='待填写', max_length=40)
    has_notes: bool = False
    description: str | None = Field(default=None, max_length=2000)
    category: str = 'textbook'
    pickup_point: str | None = Field(default=None, max_length=120)


    @field_validator('title')
    @classmethod
    def strip_title(cls, value: str) -> str:
        if not value.strip():
            raise ValueError('书名不能为空')
        return value.strip()


class BookRead(APIModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)

    id: UUID
    seller_id: str
    title: str
    author: str | None
    publisher: str | None
    edition: str | None
    price: float
    price_cents: int
    condition: str
    has_notes: bool
    description: str | None
    category: BookCategory
    status: BookStatus
    pickup_point: str | None
    ai_status: str
    cover_url: str | None = None
    created_at: datetime


class BookListResponse(APIModel):
    items: list[BookRead]
    page: int
    page_size: int
    total: int
