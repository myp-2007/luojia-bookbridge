from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.core.naming import to_camel
from app.core.dates import UTCDatetime
from app.models.reservation import ReservationStatus


class APIModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class ReservationCreate(APIModel):
    pickup_point: str | None = Field(default=None, max_length=120)
    proposed_time: UTCDatetime | None = None


class ReservationRead(APIModel):
    id: UUID
    book_title: str
    seller_id: str
    book_id: UUID
    buyer_id: str
    status: ReservationStatus
    pickup_point: str | None
    proposed_time: UTCDatetime | None
    expires_at: UTCDatetime | None
    seller_confirmed_at: UTCDatetime | None
    buyer_confirmed_at: UTCDatetime | None
    completed_at: UTCDatetime | None
    created_at: UTCDatetime
