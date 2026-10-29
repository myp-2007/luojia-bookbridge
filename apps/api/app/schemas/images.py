from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.core.naming import to_camel


class BookImageRead(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)

    id: UUID
    book_id: UUID
    original_name: str
    content_type: str
    size_bytes: int
    url: str
    created_at: datetime
