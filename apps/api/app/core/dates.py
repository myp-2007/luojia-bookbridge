from datetime import datetime, timezone
from typing import Annotated

from pydantic import AfterValidator


def as_utc(value: datetime) -> datetime:
    # SQLite drops timezone metadata; server timestamps and stored inputs are UTC.
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


UTCDatetime = Annotated[datetime, AfterValidator(as_utc)]
