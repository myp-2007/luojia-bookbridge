from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ReservationCreate(BaseModel):
    pickup_point: str | None = Field(default=None, max_length=120)
    proposed_time: datetime | None = None


class ReservationRead(BaseModel):
    id: UUID
    book_id: UUID
    buyer_id: str
    status: str
    pickup_point: str | None
    proposed_time: datetime | None
    expires_at: datetime | None
    created_at: datetime
