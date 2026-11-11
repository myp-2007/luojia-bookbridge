from io import BytesIO
from uuid import uuid4

import httpx
from fastapi.testclient import TestClient
from PIL import Image
from pydantic import SecretStr
import pytest
from sqlalchemy import delete, select

from app.core.config import get_settings
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models.user import AuthThrottle, User, UserSession


def setup_module():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(get_settings(), 'allow_dev_auth', False)
    monkeypatch.setattr(get_settings(), 'allow_legacy_headers', False)
    monkeypatch.setattr(get_settings(), 'environment', 'test')
    with SessionLocal() as db:
        db.execute(delete(AuthThrottle)); db.commit()
    with TestClient(app) as value:
        yield value


def register(client, prefix='reader'):
    username = prefix + uuid4().hex[:10]
    response = client.post('/api/v1/auth/register', json={'username': username, 'password': 'LocalBooks_2026', 'nickname': '新书友'})
    assert response.status_code == 201
    return username, response.json()


def image_bytes():
    data = BytesIO()
    Image.new('RGB', (25, 30), 'blue').save(data, 'PNG')
    return data.getvalue()


def test_baidu_places_require_login_and_keep_credentials_server_side(client, monkeypatch):
    url = '/api/v1/maps/places'
    assert client.get(url, params={'q': '武汉大学图书馆'}).status_code == 401
    register(client)
    settings = get_settings()
    monkeypatch.setattr(settings, 'baidu_map_ak', None)
    assert client.get(url, params={'q': '武汉大学图书馆'}).status_code == 503
    assert client.get(url, params={'q': '  '}).status_code == 422
    monkeypatch.setattr(settings, 'baidu_map_ak', SecretStr('baidu-test-key'))

    def fake_baidu(endpoint, *, params, timeout):
        assert endpoint == 'https://api.map.baidu.com/place/v3/region'
        assert params['ak'] == 'baidu-test-key'
        assert params['region'] == '武汉市' and params['region_limit'] == 'true'
        assert timeout <= 5
        if params['query'] == 'IP白名单测试':
            return httpx.Response(200, json={'status': 210, 'message': 'private upstream error'}, request=httpx.Request('GET', endpoint))
        content = {'status': 0, 'results': [
            {'name': '武汉大学图书馆', 'address': '测试地址', 'location': {'lat': 30.54, 'lng': 114.36}},
            {'name': '无效地点', 'location': {'lat': 999, 'lng': 114.36}},
        ]} if params['query'] == '武汉大学图书馆' else {'status': 5, 'message': 'private upstream error'}
        return httpx.Response(200, json=content, request=httpx.Request('GET', endpoint))

    monkeypatch.setattr('app.routers.maps.httpx.get', fake_baidu)
    response = client.get(url, params={'q': ' 武汉大学图书馆 '})
    assert response.json() == {'items': [{
        'name': '武汉大学图书馆', 'address': '测试地址', 'location': {'latitude': 30.54, 'longitude': 114.36},
    }]}
    rejected = client.get(url, params={'q': '其他地点'})
    assert rejected.status_code == 502 and 'private upstream error' not in rejected.text
    ip_rejected = client.get(url, params={'q': 'IP白名单测试'})
    assert ip_rejected.status_code == 502
    assert 'IP 白名单校验失败' in ip_rejected.json()['message']
    assert 'baidu-test-key' not in ip_rejected.text and 'private upstream error' not in ip_rejected.text


def test_recommendations_use_real_prices_and_locations(client, monkeypatch):
    url = '/api/v1/ai/recommendations'
    point = {'latitude': 30.54, 'longitude': 114.36}
    assert client.post(url, json={'query': '高数', 'sort': 'price'}).status_code == 401
    register(client, 'seller')

    def publish(title, price, location=None):
        response = client.post('/api/v1/books', json={
            'title': title, 'priceCents': price, 'pickupPoint': '图书馆', 'pickupLocation': location,
        })
        assert response.status_code == 201
        return response.json()

    near = publish('高等数学第七版 近处', 1800, point)
    far = publish('高等数学第七版 远处', 900, {**point, 'latitude': 30.56})
    manual = publish('高等数学第七版 手填地点', 500)
    publish('高等数学第六版', 100, point)
    hidden = publish('高等数学第七版 已下架', 100, point)
    assert client.post(f"/api/v1/books/{hidden['id']}/offline").status_code == 200
    register(client, 'buyer')
    publish('高等数学第七版 自己的书', 100, point)

    settings = get_settings()
    monkeypatch.setattr(settings, 'ai_provider', 'openai-compatible')
    monkeypatch.setattr(settings, 'ai_base_url', 'https://api.deepseek.com')
    monkeypatch.setattr(settings, 'ai_api_key', SecretStr('deepseek-test-key'))
    query = '想找高数第七版'

    def fake_model(endpoint, *, headers, json, timeout):
        assert endpoint == 'https://api.deepseek.com/chat/completions'
        assert headers['Authorization'] == 'Bearer deepseek-test-key'
        assert json['model'] == 'deepseek-flash'
        assert json['messages'][-1] == {'role': 'user', 'content': query}
        assert 'origin' not in json and timeout <= 8
        return httpx.Response(200, json={
            'choices': [{'message': {'content': '{"keywords":["高数","第七版"]}'}}],
        }, request=httpx.Request('POST', endpoint))

    monkeypatch.setattr('app.providers.deepseek.httpx.post', fake_model)
    by_price = client.post(url, json={'query': query, 'sort': 'price'}).json()
    assert by_price['source'] == 'deepseek' and by_price['keywords'] == ['高数', '第七版']
    assert [item['book']['id'] for item in by_price['items']] == [manual['id'], far['id'], near['id']]
    assert client.post(url, json={'query': query, 'sort': 'distance'}).status_code == 422
    by_distance = client.post(url, json={'query': query, 'sort': 'distance', 'origin': point}).json()
    assert [item['book']['id'] for item in by_distance['items']] == [near['id'], far['id']]
    assert by_distance['items'][0]['distanceMeters'] == 0
    assert 2200 < by_distance['items'][1]['distanceMeters'] < 2250
    assert by_distance['unlocatedCount'] == 1

    monkeypatch.setattr(settings, 'ai_api_key', None)
    basic = client.post(url, json={'query': '高数 第七版', 'sort': 'price'}).json()
    assert basic['source'] == 'keyword'
    assert [item['book']['id'] for item in basic['items']] == [manual['id'], far['id'], near['id']]


def test_book_pickup_coordinates_follow_the_location_text(client):
    register(client)
    data = {'title': '线性代数', 'pickupPoint': '图书馆'}
    point = {'latitude': 30.54, 'longitude': 114.36}
    assert client.post('/api/v1/books', json={'title': '线性代数', 'pickupLocation': point}).status_code == 422
    book = client.post('/api/v1/books', json={**data, 'pickupLocation': point}).json()
    assert book['pickupLocation'] == point
    url = f"/api/v1/books/{book['id']}"
    assert client.patch(url, json={**data, 'title': '线性代数上册'}).json()['pickupLocation'] == point
    assert client.patch(url, json={**data, 'pickupPoint': '校门'}).json()['pickupLocation'] is None


def test_register_login_logout_hash_and_duplicate_account(client):
    username, user = register(client)
    assert user['username'] == username and user['role'] == 'student'
    assert client.get('/api/v1/me').json()['id'] == user['id']
    assert 'password' not in user and 'passwordHash' not in user
    with SessionLocal() as db:
        stored = db.get(User, user['id'])
        assert stored.password_hash.startswith('scrypt$') and 'LocalBooks_2026' not in stored.password_hash
    assert client.post('/api/v1/auth/register', json={'username': username.upper(), 'password': 'LocalBooks_2026'}).status_code == 409
    assert client.post('/api/v1/auth/register', json={'username': 'badrole', 'password': 'LocalBooks_2026', 'role': 'admin'}).status_code == 422
    assert client.post('/api/v1/auth/register', json={'username': 'okname', 'password': 'short'}).status_code == 422
    client.post('/api/v1/auth/logout')
    assert client.get('/api/v1/me').status_code == 401
    assert client.post('/api/v1/auth/login', json={'username': username, 'password': 'wrongpassword'}).status_code == 401
    assert client.post('/api/v1/auth/login', json={'username': username.upper(), 'password': 'LocalBooks_2026'}).json()['id'] == user['id']
    assert client.post('/api/v1/auth/dev-login', json={'userId': 'demo-admin'}).status_code == 404
    assert client.get('/api/v1/auth/demo-accounts').status_code == 404


def test_profile_avatar_public_privacy_and_persistence(client):
    _, user = register(client)
    result = client.patch('/api/v1/me', json={'nickname': '有自己的书架', 'gender': 'female', 'college': '数学与统计学院', 'bio': '喜欢数学和旧书', 'contact': 'private-only'})
    assert result.status_code == 200 and result.json()['gender'] == 'female'
    assert client.patch('/api/v1/me', json={'gender': 'invalid'}).status_code == 422
    assert client.patch('/api/v1/me', json={'role': 'admin'}).status_code == 422
    response = client.post('/api/v1/me/avatar', files={'file': ('my.png', image_bytes(), 'image/png')})
    assert response.status_code == 200
    avatar = response.json()['avatarUrl']
    assert client.get(avatar).status_code == 200
    public = client.get('/api/v1/users/' + user['id']).json()
    assert public['bio'] == '喜欢数学和旧书'
    assert set(public) == {'id','nickname','college','bio','avatarUrl'}
    assert 'private-only' not in str(public)
    with TestClient(app) as second:
        assert second.get('/api/v1/users/' + user['id']).json()['avatarUrl'] == avatar
        assert second.patch('/api/v1/me', json={'bio': '不能越权'}).status_code == 401
    assert client.post('/api/v1/me/avatar', files={'file': ('bad.png', b'not-a-real-image', 'image/png')}).status_code == 400
    assert client.get('/api/v1/me').json()['avatarUrl'] == avatar
    assert client.delete('/api/v1/me/avatar').status_code == 204
    assert client.get(avatar).status_code == 404
    assert client.get('/api/v1/me').json()['bio'] == '喜欢数学和旧书'


def test_new_account_publishes_searches_and_keeps_private_favorites(client):
    _, seller = register(client, 'seller')
    first = client.post('/api/v1/books', json={'title': '高等数学专项教材', 'author': '同济大学', 'isbn': '978-7-04-039663-8', 'priceCents': 1800}).json()
    second = client.post('/api/v1/books', json={'title': 'C 语言程序设计专项', 'priceCents': 800}).json()
    for q in ['高数 专项', '9787040396638', '978-7-04-039663-8']:
        assert first['id'] in [book['id'] for book in client.get('/api/v1/books', params={'q': q}).json()['items']]
    assert second['id'] in [book['id'] for book in client.get('/api/v1/books', params={'q': 'C语言 专项'}).json()['items']]
    assert client.get('/api/v1/me/stats').json()['published'] == 2
    public = client.get(f"/api/v1/users/{seller['id']}/books").json()
    assert public['total'] == 2
    client.post('/api/v1/auth/logout')
    _, buyer = register(client, 'buyer')
    assert client.post(f"/api/v1/books/{first['id']}/favorite").status_code == 204
    assert client.post(f"/api/v1/books/{first['id']}/favorite").status_code == 204
    assert client.get('/api/v1/me/favorites').json()['total'] == 1
    assert client.get(f"/api/v1/books/{first['id']}").json()['isFavorite']
    assert client.patch(f"/api/v1/books/{first['id']}", json={'title': '越权修改'}).status_code == 403
    assert client.delete(f"/api/v1/books/{first['id']}/favorite").status_code == 204
    assert client.get('/api/v1/me/favorites').json()['total'] == 0


def test_password_change_revokes_all_sessions(client):
    username, user = register(client)
    with TestClient(app) as second:
        second.post('/api/v1/auth/login', json={'username': username, 'password': 'LocalBooks_2026'})
        assert client.post('/api/v1/auth/password', json={'currentPassword': 'wrongpassword', 'newPassword': 'BrandNew_2026'}).status_code == 400
        assert client.post('/api/v1/auth/password', json={'currentPassword': 'LocalBooks_2026', 'newPassword': 'BrandNew_2026'}).status_code == 204
        assert client.get('/api/v1/me').status_code == 401
        assert second.get('/api/v1/me').status_code == 401
        assert second.post('/api/v1/auth/login', json={'username': username, 'password': 'LocalBooks_2026'}).status_code == 401
        assert second.post('/api/v1/auth/login', json={'username': username, 'password': 'BrandNew_2026'}).json()['id'] == user['id']


def test_login_is_throttled_and_cross_origin_signup_is_rejected(client):
    for _ in range(20):
        assert client.post('/api/v1/auth/login', json={'username': 'doesnotexist', 'password': 'invalidpassword'}).status_code == 401
    assert client.post('/api/v1/auth/login', json={'username': 'doesnotexist', 'password': 'invalidpassword'}).status_code == 429
    assert client.post('/api/v1/auth/register', json={'username': 'foreignsite', 'password': 'LocalBooks_2026'}, headers={'Origin':'https://untrusted.invalid'}).status_code == 403


def test_only_first_loopback_registration_becomes_local_admin(client):
    with SessionLocal() as db:
        assert db.scalar(select(User.id).where(User.password_hash.is_not(None), User.role == 'admin')) is None
    with TestClient(app, client=('127.0.0.1', 45678)) as local:
        _, first = register(local, 'owner')
        _, next_user = register(local, 'later')
        assert first['role'] == 'admin'
        assert next_user['role'] == 'student'


def test_spa_refresh_works_but_unknown_api_and_images_stay_404(client):
    assert client.get('/discover?q=高数', headers={'Accept':'text/html'}).status_code == 200
    assert client.get('/me/edit', headers={'Accept':'text/html'}).status_code == 200
    assert client.get('/api/v1/missing', headers={'Accept':'text/html'}).status_code == 404
    assert client.get('/storage/missing.jpg', headers={'Accept':'text/html'}).status_code == 404


def test_inactive_legacy_seller_is_visible_but_cannot_receive_new_reservations(client):
    from app.models.book import Book, BookStatus
    register(client)
    with SessionLocal() as db:
        seller = User(id='legacy-' + uuid4().hex, nickname='旧版书架', is_demo=True, college='')
        db.add(seller)
        book = Book(seller_id=seller.id, title='历史书架记录', price_cents=100, status=BookStatus.AVAILABLE)
        db.add(book); db.commit(); book_id = book.id
    assert client.get(f'/api/v1/books/{book_id}').json()['sellerActive'] is False
    result = client.post(f'/api/v1/books/{book_id}/reservations', json={})
    assert result.status_code == 409 and '发布者当前不可交易' in result.json()['message']


def test_old_passwordless_session_is_not_a_real_login(client):
    from app.core.auth import token_hash
    from datetime import datetime, timedelta, timezone
    with SessionLocal() as db:
        user = User(id='old-session-user', nickname='旧账号', is_demo=True, college='')
        db.add(user); db.flush()
        db.add(UserSession(token_hash=token_hash('old-development-token'), user_id=user.id, expires_at=datetime.now(timezone.utc) + timedelta(hours=8)))
        db.commit()
    client.cookies.set('bookbridge_session', 'old-development-token')
    assert client.get('/api/v1/me').status_code == 401
