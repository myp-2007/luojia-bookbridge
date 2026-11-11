from typing import Annotated, Literal

from pydantic import Field, StringConstraints, field_validator, model_validator

from app.schemas.books import APIModel, BookRead
from app.schemas.maps import Coordinates


class RecommendationQuery(APIModel):
    query: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
    sort: Literal['price', 'distance']
    origin: Coordinates | None = None

    @field_validator('query')
    @classmethod
    def meaningful_query(cls, value: str) -> str:
        if not any(char.isalnum() for char in value):
            raise ValueError('请输入书名、版本或 ISBN')
        return value

    @model_validator(mode='after')
    def require_origin_for_distance(self):
        if self.sort == 'distance' and self.origin is None:
            raise ValueError('按距离排序时请选择地图起点')
        return self


class RecommendationItem(APIModel):
    book: BookRead
    distance_meters: int | None = Field(ge=0)


class RecommendationResult(APIModel):
    items: list[RecommendationItem] = Field(max_length=12)
    keywords: list[str]
    source: Literal['deepseek', 'keyword']
    unlocated_count: int = Field(ge=0)
