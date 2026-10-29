from pydantic import BaseModel, ConfigDict

from app.core.naming import to_camel


class RecognitionFieldRead(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    value: str | None
    confidence: float


class BookRecognitionRead(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    title: RecognitionFieldRead
    author: RecognitionFieldRead
    publisher: RecognitionFieldRead
    edition: RecognitionFieldRead
    warnings: list[str]
    provider: str
