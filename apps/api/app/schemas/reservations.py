from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.core.naming import to_camel


class APIModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class ReservationCreate(APIModel):
    pickup_point: str | None = Field(default=None, max_length=120)
    proposed_time: datetime | None = None


class ReservationRead(APIModel):
    id: UUID
    book_id: UUID
    buyer_id: str
    status: str
    pickup_point: str | None
    proposed_time: datetime | None
    expires_at: datetime | None
    seller_confirmed_at: datetime | None
    buyer_confirmed_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
