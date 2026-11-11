from pydantic import BaseModel, Field


class Coordinates(BaseModel):
    """百度地图 BD-09 经纬度。"""

    latitude: float = Field(ge=-90, le=90, allow_inf_nan=False)
    longitude: float = Field(ge=-180, le=180, allow_inf_nan=False)


class Place(BaseModel):
    name: str
    address: str
    location: Coordinates


class PlaceSearchResult(BaseModel):
    items: list[Place] = Field(max_length=8)
