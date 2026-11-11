from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.auth import get_current_user_id
from app.core.config import get_settings
from app.db.session import get_db
from app.schemas.maps import Coordinates, Place, PlaceSearchResult

router = APIRouter(prefix='/maps', tags=['maps'])


@router.get('/places', response_model=PlaceSearchResult, responses={
    401: {'description': '请先登录'},
    502: {'description': '百度地图上游查询失败'},
    503: {'description': '百度地图 AK 未配置'},
})
def search_places(
    q: Annotated[str, Query(min_length=1, max_length=120)],
    _: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> PlaceSearchResult:
    query = q.strip()
    if not query:
        raise HTTPException(422, '请输入要查询的地点')
    ak = get_settings().baidu_map_ak
    if not ak:
        raise HTTPException(503, '百度地图搜索尚未配置，可手动填写地点')
    # The auth dependency starts a SQLite transaction. Release it before remote I/O.
    db.rollback()
    try:
        response = httpx.get(
            'https://api.map.baidu.com/place/v3/region',
            params={
                'query': query, 'region': '武汉市', 'region_limit': 'true',
                'output': 'json', 'ak': ak.get_secret_value(),
            },
            timeout=5,
        )
        response.raise_for_status()
        body = response.json()
        if isinstance(body, dict) and body.get('status') == 210:
            raise HTTPException(502, '百度地图 IP 白名单校验失败，请在百度控制台添加网站主机的公网出口 IP 后重试')
        if not isinstance(body, dict) or body.get('status') != 0:
            raise ValueError('Baidu Place API rejected the request')
        rows = body.get('results', [])
        if not isinstance(rows, list):
            raise ValueError('Invalid Place API response')
    except (httpx.HTTPError, ValueError):
        raise HTTPException(502, '百度地图暂时无法查询，可稍后重试或手动填写地点') from None

    places: list[Place] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        name, address, location = row.get('name'), row.get('address'), row.get('location')
        if not isinstance(name, str) or not name.strip() or not isinstance(location, dict):
            continue
        try:
            point = Coordinates(latitude=location.get('lat'), longitude=location.get('lng'))
        except ValidationError:
            continue
        places.append(Place(name=name.strip(), address=address.strip() if isinstance(address, str) else '', location=point))
        if len(places) == 8:
            break
    return PlaceSearchResult(items=places)
