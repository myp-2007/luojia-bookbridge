from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.core.naming import to_camel


class ReportCreate(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    target_type: str = Field(min_length=1, max_length=40)
    target_id: str = Field(min_length=1, max_length=120)
    reason: str = Field(min_length=1, max_length=80)
    description: str = Field(min_length=1, max_length=2000)


class ReportRead(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)

    id: UUID
    reporter_id: str
    target_type: str
    target_id: str
    reason: str
    description: str
    status: str
    handler_id: str | None
    resolution: str | None
    created_at: datetime
    resolved_at: datetime | None


class ReportResolve(BaseModel):
    status: str = Field(pattern='^(resolved|rejected)$')
    resolution: str = Field(min_length=1, max_length=2000)
