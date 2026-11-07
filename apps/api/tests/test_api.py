import os

os.environ['DATABASE_URL'] = 'sqlite:///./test_bookbridge.db'
os.environ['AI_PROVIDER'] = 'mock'
os.environ['ENVIRONMENT'] = 'development'
os.environ['ALLOW_LEGACY_HEADERS'] = 'true'

from fastapi.testclient import TestClient

from app.db.base import Base
from app.db.session import engine
from app.core.config import get_settings
from app.main import app


def setup_module() -> None:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def test_health() -> None:
    with TestClient(app) as client:
        response = client.get('/api/v1/health')
    assert response.status_code == 200
    assert response.json()['status'] == 'ok'


def test_book_creation_and_search() -> None:
    with TestClient(app) as client:
        created = client.post('/api/v1/books', json={'title': '高等数学（第七版）', 'price': 22, 'condition': '9成新', 'pickup_point': '图书馆附近'}, headers={'X-User-Id': 'seller-1'})
        assert created.status_code == 201
        book = created.json()
        assert book['price'] == 22
        assert book['status'] == 'available'

        result = client.get('/api/v1/books', params={'q': '高等数学'})
        assert result.status_code == 200
        assert result.json()['total'] == 1
        assert result.json()['items'][0]['id'] == book['id']


def test_only_one_active_reservation_is_allowed() -> None:
    with TestClient(app) as client:
        created = client.post('/api/v1/books', json={'title': 'C 语言程序设计', 'price': 20}, headers={'X-User-Id': 'seller-2'})
        book_id = created.json()['id']

        first = client.post(f'/api/v1/books/{book_id}/reservations', json={'pickup_point': '工学部二教'}, headers={'X-User-Id': 'buyer-1'})
        second = client.post(f'/api/v1/books/{book_id}/reservations', json={}, headers={'X-User-Id': 'buyer-2'})

        assert first.status_code == 201
        assert second.status_code == 409
        assert second.json()['detail'] == '该书当前不可预约'


def test_seller_can_confirm_and_buyer_can_cancel() -> None:
    with TestClient(app) as client:
        created = client.post('/api/v1/books', json={'title': '大学物理', 'price': 16}, headers={'X-User-Id': 'seller-3'})
        book_id = created.json()['id']
        reservation = client.post(f'/api/v1/books/{book_id}/reservations', json={}, headers={'X-User-Id': 'buyer-3'}).json()

        confirmed = client.post(f"/api/v1/reservations/{reservation['id']}/confirm", headers={'X-User-Id': 'seller-3'})
        assert confirmed.status_code == 200
        assert confirmed.json()['status'] == 'confirmed'

        cancelled = client.post(f"/api/v1/reservations/{reservation['id']}/cancel", headers={'X-User-Id': 'buyer-3'})
        assert cancelled.status_code == 200
        assert cancelled.json()['status'] == 'cancelled'
        assert client.get(f'/api/v1/books/{book_id}').json()['status'] == 'available'


def test_both_parties_confirm_handover_completes_transaction() -> None:
    with TestClient(app) as client:
        created = client.post('/api/v1/books', json={'title': '离散数学', 'price': 18}, headers={'X-User-Id': 'seller-handover'}).json()
        book_id = created['id']
        reservation = client.post(f'/api/v1/books/{book_id}/reservations', json={}, headers={'X-User-Id': 'buyer-handover'}).json()
        reservation_id = reservation['id']

        accepted = client.post(f'/api/v1/reservations/{reservation_id}/confirm', headers={'X-User-Id': 'seller-handover'})
        assert accepted.status_code == 200

        seller_confirmed = client.post(f'/api/v1/reservations/{reservation_id}/seller-confirm', headers={'X-User-Id': 'seller-handover'})
        assert seller_confirmed.status_code == 200
        assert seller_confirmed.json()['status'] == 'confirmed'
        assert seller_confirmed.json()['sellerConfirmedAt']

        buyer_confirmed = client.post(f'/api/v1/reservations/{reservation_id}/buyer-confirm', headers={'X-User-Id': 'buyer-handover'})
        assert buyer_confirmed.status_code == 200
        assert buyer_confirmed.json()['status'] == 'completed'
        assert buyer_confirmed.json()['completedAt']
        assert client.get(f'/api/v1/books/{book_id}').json()['status'] == 'completed'


def test_seller_can_upload_book_image() -> None:
    from io import BytesIO
    from PIL import Image
    buffer = BytesIO()
    Image.new('RGB', (8, 8), 'green').save(buffer, format='PNG')
    png = buffer.getvalue()
    with TestClient(app) as client:
        created = client.post('/api/v1/books', json={'title': '数据结构', 'price': 21}, headers={'X-User-Id': 'seller-image'}).json()
        response = client.post(
            f"/api/v1/books/{created['id']}/images",
            files={'file': ('cover.png', png, 'image/png')},
            headers={'X-User-Id': 'seller-image'},
        )
        assert response.status_code == 201
        assert response.json()['contentType'] == 'image/png'
        assert response.json()['sizeBytes'] == len(png)
        listed = client.get(f"/api/v1/books/{created['id']}/images")
        assert listed.status_code == 200
        assert len(listed.json()) == 1
        assert listed.json()[0]['url'].startswith('/storage/')


def test_mock_ai_recognition_returns_structured_fields() -> None:
    with TestClient(app) as client:
        created = client.post('/api/v1/books', json={'title': '高等数学', 'price': 22}, headers={'X-User-Id': 'seller-ai'}).json()
        response = client.post(f"/api/v1/books/{created['id']}/ai-extract", headers={'X-User-Id': 'seller-ai'})
        assert response.status_code == 200
        assert response.json()['provider'] == 'mock'
        assert response.json()['title']['value'] == '高等数学'
        assert response.json()['title']['confidence'] > 0.9


def test_report_and_admin_resolution_flow() -> None:
    with TestClient(app) as client:
        target = client.post('/api/v1/books', json={'title': 'report target'}, headers={'X-User-Id': 'reporter-1'}).json()
        created = client.post('/api/v1/reports', json={'targetType': 'book', 'targetId': target['id'], 'reason': '描述不符', 'description': '书籍版本与发布信息不一致'}, headers={'X-User-Id': 'reporter-1'})
        assert created.status_code == 201
        report_id = created.json()['id']
        denied = client.get('/api/v1/reports/admin', headers={'X-Role': 'student'})
        assert denied.status_code == 403
        resolved = client.post(f'/api/v1/reports/admin/{report_id}/resolve', json={'status': 'resolved', 'resolution': '已联系双方并完成核实'}, headers={'X-Role': 'admin'})
        assert resolved.status_code == 200
        assert resolved.json()['status'] == 'resolved'


def test_dev_headers_are_disabled_when_dev_auth_is_off() -> None:
    settings = get_settings()
    previous_auth, previous_environment = settings.allow_dev_auth, settings.environment
    settings.allow_dev_auth = False
    try:
        with TestClient(app) as client:
            user_response = client.post('/api/v1/books', json={'title': '权限测试', 'price': 1}, headers={'X-User-Id': 'spoofed-user'})
            admin_response = client.get('/api/v1/reports/admin', headers={'X-Role': 'admin'})
        assert user_response.status_code == 401
        assert admin_response.status_code == 401
    finally:
        settings.allow_dev_auth, settings.environment = previous_auth, previous_environment


def test_dev_headers_are_disabled_in_production_even_if_flag_is_set() -> None:
    settings = get_settings()
    previous_auth, previous_environment = settings.allow_dev_auth, settings.environment
    settings.allow_dev_auth, settings.environment = True, 'production'
    try:
        with TestClient(app) as client:
            response = client.post('/api/v1/books', json={'title': '生产环境测试', 'price': 1}, headers={'X-User-Id': 'spoofed-user'})
        assert response.status_code == 401
    finally:
        settings.allow_dev_auth, settings.environment = previous_auth, previous_environment

import pytest
from datetime import datetime, timedelta, timezone
from uuid import uuid4
from app.db.session import SessionLocal
from app.models.reservation import Reservation, ReservationStatus
from app.models.user import UserSession, AuditLog
from app.demo_seed import seed
from sqlalchemy import select


@pytest.fixture
def session_client(monkeypatch):
    monkeypatch.setattr(get_settings(), 'allow_legacy_headers', False)
    seed()
    with TestClient(app) as client:
        yield client


def demo_login(client, user='demo-buyer'):
    result = client.post('/api/v1/auth/dev-login', json={'userId': user})
    assert result.status_code == 200
    assert 'HttpOnly' in result.headers['set-cookie']
    return result.json()


def make_trade(client):
    demo_login(client, 'demo-seller')
    book = client.post('/api/v1/books', json={'title': str(uuid4()), 'priceCents': 1234}).json()
    assert book['priceCents'] == 1234 and book['price'] == 12.34
    demo_login(client)
    reservation = client.post(f"/api/v1/books/{book['id']}/reservations", json={}).json()
    return book, reservation


def test_session_login_logout_and_header_spoofing(session_client):
    client = session_client
    assert client.get('/api/v1/me', headers={'X-User-Id': 'demo-admin', 'X-Role': 'admin'}).status_code == 401
    assert client.post('/api/v1/auth/dev-login', json={'userId': 'unknown'}).status_code == 403
    user = demo_login(client)
    assert client.get('/api/v1/me').json()['id'] == user['id']
    assert client.get('/api/v1/reports/admin', headers={'X-Role': 'admin'}).status_code == 403
    cookie = client.cookies.get('bookbridge_session')
    client.post('/api/v1/auth/logout')
    assert client.get('/api/v1/me').status_code == 401
    with TestClient(app) as other:
        other.cookies.set('bookbridge_session', cookie)
        assert other.get('/api/v1/me').status_code == 401


def test_expired_session_cannot_access_me(session_client):
    client = session_client
    demo_login(client)
    with SessionLocal() as db:
        session = db.scalar(select(UserSession).where(UserSession.user_id == 'demo-buyer'))
        session.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        db.commit()
    assert client.get('/api/v1/me').status_code == 401


def test_book_edit_offline_publish_permissions(session_client):
    client = session_client
    demo_login(client, 'demo-seller')
    book = client.post('/api/v1/books', json={'title': '可编辑书', 'price': 10}).json()
    path = f"/api/v1/books/{book['id']}"
    assert client.patch(path, json={'title': '修订版', 'priceCents': 999}).json()['priceCents'] == 999
    assert client.post(path + '/offline').json()['status'] == 'offline'
    assert client.post(path + '/publish').json()['status'] == 'available'
    demo_login(client)
    assert client.patch(path, json={'title': '越权'}).status_code == 403
    assert client.post('/api/v1/books', json={'title': '   '}).status_code == 422


def test_pending_expiry_releases_book(session_client):
    client = session_client
    book, reservation = make_trade(client)
    with SessionLocal() as db:
        from uuid import UUID
        record = db.get(Reservation, UUID(reservation['id']))
        record.expires_at = datetime.now(timezone.utc) - timedelta(seconds=5)
        db.commit()
    items = client.get('/api/v1/reservations/mine').json()
    assert next(r for r in items if r['id'] == reservation['id'])['status'] == 'expired'
    assert client.get(f"/api/v1/books/{book['id']}").json()['status'] == 'available'


def test_trade_contacts_dispute_and_admin_resolution(session_client):
    client = session_client
    book, reservation = make_trade(client)
    path = f"/api/v1/reservations/{reservation['id']}"
    assert client.get(path + '/contact').status_code == 403
    demo_login(client, 'demo-seller')
    client.patch('/api/v1/me', json={'nickname': '小珞', 'contact': '演示联系信息'})
    assert client.post(path + '/confirm').status_code == 200
    assert client.post(f"/api/v1/books/{book['id']}/offline").status_code == 409
    demo_login(client)
    assert client.get(path + '/contact').json()['contact'] == '演示联系信息'
    assert client.post(path + '/buyer-confirm').json()['status'] == 'confirmed'
    assert client.post(path + '/cancel').status_code == 409
    assert client.post(path + '/dispute').json()['status'] == 'disputed'
    report = client.post('/api/v1/reports', json={'targetType': 'reservation', 'targetId': reservation['id'], 'reason': '交接争议', 'description': '需要处理'}).json()
    demo_login(client, 'demo-reader')
    assert client.get(path + '/contact').status_code == 403
    assert client.post(path + '/seller-confirm').status_code == 403
    demo_login(client, 'demo-admin')
    resolved = client.post(f"/api/v1/reports/admin/{report['id']}/resolve", json={'status': 'resolved', 'resolution': '核实后取消', 'outcome': 'cancel'})
    assert resolved.status_code == 200
    assert client.get(f"/api/v1/books/{book['id']}").json()['status'] == 'available'
    assert client.get('/api/v1/admin/audit-logs').json()['items']


def test_completed_confirmation_is_idempotent_and_private(session_client):
    client = session_client
    book, reservation = make_trade(client)
    path = f"/api/v1/reservations/{reservation['id']}"
    demo_login(client, 'demo-seller')
    client.post(path + '/confirm')
    client.post(path + '/seller-confirm')
    demo_login(client)
    completed = client.post(path + '/buyer-confirm').json()
    assert completed['status'] == 'completed'
    assert client.post(path + '/buyer-confirm').json()['completedAt'] == completed['completedAt']
    demo_login(client, 'demo-reader')
    assert client.post(path + '/buyer-confirm').status_code == 403
    assert client.post(path + '/cancel').status_code == 403


def test_fake_image_is_rejected(session_client):
    client = session_client
    demo_login(client)
    book = client.post('/api/v1/books', json={'title': '图片检查'}).json()
    response = client.post(f"/api/v1/books/{book['id']}/images", files={'file': ('fake.png', b'not an image', 'image/png')})
    assert response.status_code == 400


def test_concurrent_reservations_have_one_winner(session_client):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    client = session_client
    demo_login(client, 'demo-seller')
    book = client.post('/api/v1/books', json={'title': str(uuid4())}).json()
    with TestClient(app) as other:
        demo_login(client, 'demo-buyer')
        demo_login(other, 'demo-reader')
        barrier = Barrier(2)
        def reserve(actor):
            barrier.wait(timeout=5)
            return actor.post(f"/api/v1/books/{book['id']}/reservations", json={}).status_code
        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(reserve, [client, other]))
        assert sorted(results) == [201, 409]


def test_concurrent_handover_does_not_lose_confirmation(session_client):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    client = session_client
    book, reservation = make_trade(client)
    path = f"/api/v1/reservations/{reservation['id']}"
    with TestClient(app) as seller:
        demo_login(seller, 'demo-seller')
        seller.post(path + '/confirm')
        barrier = Barrier(2)
        def confirm(pair):
            actor, action = pair
            barrier.wait(timeout=5)
            return actor.post(path + action).status_code
        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(confirm, [(client, '/buyer-confirm'), (seller, '/seller-confirm')]))
        assert results == [200, 200]
    assert client.get(f"/api/v1/books/{book['id']}").json()['status'] == 'completed'


def test_seed_is_repeatable_and_backup_can_restore(tmp_path, monkeypatch):
    import sqlite3
    from app.demo_backup import backup
    seed()
    from app.models.user import User
    with SessionLocal() as db:
        original = db.scalar(select(User).where(User.id == 'demo-buyer')).nickname
    seed()
    with SessionLocal() as db:
        assert db.get(User, 'demo-buyer').nickname == original
    # Dedicated database for the backup/restore check.
    source_path = tmp_path / 'source.db'
    with sqlite3.connect(source_path) as db:
        db.execute('create table sample (id integer primary key, title text)')
        db.execute("insert into sample values (1, 'preserved')")
    monkeypatch.setattr(get_settings(), 'database_url', 'sqlite:///' + source_path.as_posix())
    monkeypatch.setattr(get_settings(), 'storage_dir', str(tmp_path / 'images'))
    monkeypatch.chdir(tmp_path)
    directory = backup()
    with sqlite3.connect(directory / 'demo.db') as restored:
        assert restored.execute('select title from sample').fetchone()[0] == 'preserved'


def test_cookie_write_rejects_cross_origin_request(session_client):
    client = session_client
    demo_login(client)
    denied = client.post('/api/v1/books', json={'title': 'blocked'}, headers={'Origin': 'https://untrusted.invalid'})
    assert denied.status_code == 403
    assert denied.json()['code'] == 'INVALID_ORIGIN'


def test_image_limit_and_public_book_cover(session_client):
    from io import BytesIO
    from PIL import Image
    client = session_client
    demo_login(client)
    book = client.post('/api/v1/books', json={'title': '封面测试'}).json()
    content = BytesIO()
    Image.new('RGB', (8, 8), 'blue').save(content, format='PNG')
    for _ in range(3):
        assert client.post(f"/api/v1/books/{book['id']}/images", files={'file': ('cover.png', content.getvalue(), 'image/png')}).status_code == 201
    assert client.post(f"/api/v1/books/{book['id']}/images", files={'file': ('cover.png', content.getvalue(), 'image/png')}).status_code == 400
    assert client.get(f"/api/v1/books/{book['id']}").json()['coverUrl'].startswith('/storage/')


def test_ai_task_persists_candidates_and_checks_owner(session_client):
    client = session_client
    demo_login(client)
    book = client.post('/api/v1/books', json={'title': '任务测试'}).json()
    task = client.post(f"/api/v1/books/{book['id']}/ai-tasks")
    assert task.status_code == 202
    path = f"/api/v1/books/{book['id']}/ai-tasks/{task.json()['id']}"
    result = client.get(path).json()
    assert result['status'] == 'succeeded'
    assert result['result']['provider'] == 'mock'
    assert result['result']['title']['value'] == '任务测试'
    demo_login(client, 'demo-reader')
    assert client.get(path).status_code == 403
    assert client.post(f"/api/v1/books/{book['id']}/ai-tasks").status_code == 403


def test_unconfigured_external_ai_fails_cleanly(session_client, monkeypatch):
    client = session_client
    demo_login(client)
    monkeypatch.setattr(get_settings(), 'ai_provider', 'openai-compatible')
    monkeypatch.setattr(get_settings(), 'ai_api_key', None)
    book = client.post('/api/v1/books', json={'title': '手动兜底'}).json()
    task = client.post(f"/api/v1/books/{book['id']}/ai-tasks").json()
    result = client.get(f"/api/v1/books/{book['id']}/ai-tasks/{task['id']}").json()
    assert result['status'] == 'failed'
    assert 'AI_API_KEY' in result['error']


def test_ai_task_stale_state_recovers(session_client):
    from app.models.ai_task import AITask
    client = session_client
    demo_login(client)
    book = client.post('/api/v1/books', json={'title': '恢复任务'}).json()
    from uuid import UUID
    with SessionLocal() as db:
        task = AITask(book_id=UUID(book['id']), requested_by='demo-buyer', status='running', created_at=datetime.now(timezone.utc) - timedelta(minutes=5))
        db.add(task)
        db.commit()
        task_id = task.id
    result = client.get(f"/api/v1/books/{book['id']}/ai-tasks/{task_id}").json()
    assert result['status'] == 'failed'
    assert '超时' in result['error']


@pytest.mark.parametrize(('base_url', 'provider'), [
    ('https://vision.example/v1', 'openai-compatible'),
    ('https://api.deepseek.com', 'deepseek'),
])
def test_external_provider_adapter_validates_result_without_live_request(session_client, monkeypatch, base_url, provider):
    from io import BytesIO
    from PIL import Image
    from pydantic import SecretStr
    import httpx
    import app.services.ai_tasks as ai_service
    client = session_client
    demo_login(client)
    book = client.post('/api/v1/books', json={'title': '原始资料'}).json()
    content = BytesIO()
    Image.new('RGB', (8, 8), 'white').save(content, format='PNG')
    client.post(f"/api/v1/books/{book['id']}/images", files={'file': ('cover.png', content.getvalue(), 'image/png')})
    monkeypatch.setattr(get_settings(), 'ai_provider', 'openai-compatible')
    monkeypatch.setattr(get_settings(), 'ai_api_key', SecretStr('adapter-test-only'))
    monkeypatch.setattr(get_settings(), 'ai_model', 'test-vision-model')
    monkeypatch.setattr(get_settings(), 'ai_base_url', base_url)
    def fake_post(url, **kwargs):
        import json
        assert kwargs['json']['messages'][0]['content'][1]['type'] == 'image_url'
        if provider == 'deepseek':
            assert kwargs['json']['thinking'] == {'type': 'disabled'}
        else:
            assert 'thinking' not in kwargs['json']
        candidate = {name: {'value': '候选资料', 'confidence': 0.8} for name in ['title', 'author', 'publisher', 'edition']}
        return httpx.Response(200, request=httpx.Request('POST', url), json={'choices': [{'message': {'content': json.dumps(candidate)}}]})
    monkeypatch.setattr(ai_service.httpx, 'post', fake_post)
    task = client.post(f"/api/v1/books/{book['id']}/ai-tasks").json()
    result = client.get(f"/api/v1/books/{book['id']}/ai-tasks/{task['id']}").json()
    assert result['status'] == 'succeeded'
    assert result['result']['provider'] == provider
    assert result['result']['title']['value'] == '候选资料'
    assert client.get(f"/api/v1/books/{book['id']}").json()['title'] == '原始资料'
def test_catalog_relevance_filters_and_pagination():
    with TestClient(app) as client:
        seller = {'X-User-Id': 'catalog-seller'}
        samples = [
            ('试验代数', '林', 2000, True, '9成新'),
            ('试验代数习题', '林', 900, True, '9成新'),
            ('另一册', '试验代数 林', 600, False, '全新'),
        ]
        ids = [
            client.post('/api/v1/books', json={
                'title': title, 'author': author, 'priceCents': price,
                'hasNotes': notes, 'condition': condition,
            }, headers=seller).json()['id']
            for title, author, price, notes, condition in samples
        ]
        result = client.get('/api/v1/books', params={'q': '试验代数'}).json()
        assert [book['id'] for book in result['items']] == ids
        params = {'q': '试验代数 林', 'sort': 'price_asc', 'page_size': 1}
        first = client.get('/api/v1/books', params=params).json()
        second = client.get('/api/v1/books', params={**params, 'page': 2}).json()
        assert first['total'] == second['total'] == 3
        assert first['items'][0]['id'] == ids[2]
        assert second['items'][0]['id'] == ids[1]
        combined = {'q': '试验代数', 'min_price_cents': 800, 'max_price_cents': 1000, 'condition': '9成新', 'has_notes': True}
        assert [book['id'] for book in client.get('/api/v1/books', params=combined).json()['items']] == [ids[1]]
        client.post(f'/api/v1/books/{ids[1]}/reservations', json={}, headers={'X-User-Id': 'catalog-buyer'})
        assert client.get('/api/v1/books', params={**combined, 'available_only': True}).json()['total'] == 0
        assert client.get('/api/v1/books', params={'min_price_cents': 1000, 'max_price_cents': 500}).status_code == 400
        assert client.get('/api/v1/books', params={'q': '%_'}).json()['total'] == 0


def png_image(color='green'):
    from io import BytesIO
    from PIL import Image
    buffer = BytesIO()
    Image.new('RGB', (12, 16), color).save(buffer, format='PNG')
    return ('cover.png', buffer.getvalue(), 'image/png')


def test_image_management_cover_order_permissions_and_file_cleanup(session_client):
    client = session_client
    demo_login(client, 'demo-seller')
    book = client.post('/api/v1/books', json={'title': '图片管理回归'}).json()
    base = f"/api/v1/books/{book['id']}"
    images = [client.post(base + '/images', files={'file': png_image(color)}).json() for color in ['red', 'green', 'blue']]
    assert client.post(base + '/images', files={'file': png_image()}).status_code == 400
    assert client.get(base).json()['coverUrl'] == images[0]['url']
    demo_login(client, 'demo-buyer')
    assert client.delete(base + '/images/' + images[0]['id']).status_code == 403
    assert client.post(base + '/images/' + images[1]['id'] + '/cover').status_code == 403
    demo_login(client, 'demo-seller')
    other = client.post('/api/v1/books', json={'title': '另一册图片管理'}).json()
    assert client.delete(f"/api/v1/books/{other['id']}/images/{images[0]['id']}").status_code == 404
    chosen = client.post(base + '/images/' + images[2]['id'] + '/cover')
    assert chosen.status_code == 200
    assert [image['id'] for image in chosen.json()] == [images[2]['id'], images[0]['id'], images[1]['id']]
    assert client.get(base).json()['coverUrl'] == images[2]['url']
    assert client.delete(base + '/images/' + images[2]['id']).status_code == 204
    assert client.get(images[2]['url']).status_code == 404
    assert client.get(base).json()['coverUrl'] == images[0]['url']
    assert client.delete(base + '/images/' + images[2]['id']).status_code == 404
    assert client.post(base + '/images', files={'file': png_image()}).status_code == 201
    demo_login(client, 'demo-buyer')
    client.post(base + '/reservations', json={})
    demo_login(client, 'demo-seller')
    assert client.delete(base + '/images/' + images[0]['id']).status_code == 409
    assert client.post(base + '/ai-tasks').status_code == 409


def test_active_ai_task_locks_image_changes_until_timeout(session_client):
    from app.models.ai_task import AITask
    from datetime import datetime, timedelta, timezone
    from uuid import UUID
    client = session_client
    demo_login(client)
    book = client.post('/api/v1/books', json={'title': '识别时禁止删图'}).json()
    base = f"/api/v1/books/{book['id']}"
    image = client.post(base + '/images', files={'file': png_image()}).json()
    with SessionLocal() as db:
        task = AITask(book_id=UUID(book['id']), requested_by='demo-buyer', status='running')
        db.add(task); db.commit(); task_id = task.id
    assert client.delete(base + '/images/' + image['id']).status_code == 409
    assert client.post(base + '/images/' + image['id'] + '/cover').status_code == 409
    assert client.post(base + '/images', files={'file': png_image()}).status_code == 409
    with SessionLocal() as db:
        db.get(AITask, task_id).created_at = datetime.now(timezone.utc) - timedelta(minutes=3)
        db.commit()
    assert client.delete(base + '/images/' + image['id']).status_code == 204


def test_admin_moderation_cannot_be_bypassed_and_restoration_is_explicit(session_client):
    client = session_client
    demo_login(client, 'demo-seller')
    title = '审核限制独立回归'
    book = client.post('/api/v1/books', json={'title': title}).json()
    base = f"/api/v1/books/{book['id']}"
    admin = f"/api/v1/admin/books/{book['id']}/moderation"
    assert client.get('/api/v1/admin/books').status_code == 403
    assert client.post(admin, json={'suspended': True, 'reason': '核实'}).status_code == 403
    demo_login(client, 'demo-admin')
    assert client.post(admin, json={'suspended': True, 'reason': '   '}).status_code == 422
    result = client.post(admin, json={'suspended': True, 'reason': '图片需要核实'}).json()
    assert result['isSuspended'] and result['status'] == 'offline'
    listing = client.get('/api/v1/admin/books', params={'q': title, 'suspended': True}).json()
    assert listing['total'] == 1
    demo_login(client, 'demo-seller')
    assert client.get('/api/v1/books', params={'q': title}).json()['total'] == 0
    assert client.post(base + '/publish').status_code == 409
    assert client.patch(base, json={'title': title}).status_code == 409
    assert client.post(base + '/images', files={'file': png_image()}).status_code == 409
    assert client.post(base + '/ai-tasks').status_code == 409
    demo_login(client, 'demo-buyer')
    assert client.post(base + '/reservations', json={}).status_code == 409
    demo_login(client, 'demo-admin')
    restored = client.post(admin, json={'suspended': False, 'reason': '已核实解除'}).json()
    assert not restored['isSuspended'] and restored['status'] == 'offline'
    logs = client.get('/api/v1/admin/audit-logs', params={'page_size': 1}).json()
    next_logs = client.get('/api/v1/admin/audit-logs', params={'page_size': 1, 'page': 2}).json()
    assert logs['total'] == next_logs['total'] >= 2
    assert logs['items'][0]['id'] != next_logs['items'][0]['id']
    demo_login(client, 'demo-seller')
    assert client.post(base + '/publish').json()['status'] == 'available'


@pytest.mark.parametrize('outcome', ['cancel', 'reject', 'expire', 'dispute-cancel', 'complete'])
def test_moderation_preserves_trades_and_never_republishes_on_release(session_client, outcome):
    from datetime import datetime, timedelta, timezone
    from uuid import UUID
    from app.models.reservation import Reservation
    client = session_client
    demo_login(client, 'demo-seller')
    book = client.post('/api/v1/books', json={'title': '受限交易-' + outcome}).json()
    demo_login(client, 'demo-buyer')
    reservation = client.post(f"/api/v1/books/{book['id']}/reservations", json={}).json()
    trade = '/api/v1/reservations/' + reservation['id']
    demo_login(client, 'demo-admin')
    result = client.post(f"/api/v1/admin/books/{book['id']}/moderation", json={'suspended': True, 'reason': '核实交易'}).json()
    assert result['status'] == 'reserved'
    if outcome == 'expire':
        with SessionLocal() as db:
            db.get(Reservation, UUID(reservation['id'])).expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
            db.commit()
        client.get('/api/v1/books')
    elif outcome == 'cancel':
        demo_login(client, 'demo-buyer')
        assert client.post(trade + '/cancel').status_code == 200
    else:
        demo_login(client, 'demo-seller')
        assert client.post(trade + ('/reject' if outcome == 'reject' else '/confirm')).status_code == 200
        if outcome == 'complete':
            assert client.post(trade + '/seller-confirm').status_code == 200
            demo_login(client, 'demo-buyer')
            assert client.post(trade + '/buyer-confirm').json()['status'] == 'completed'
        elif outcome == 'dispute-cancel':
            demo_login(client, 'demo-buyer')
            client.post(trade + '/dispute')
            report = client.get('/api/v1/reports/mine').json()[0]
            demo_login(client, 'demo-admin')
            assert client.post(f"/api/v1/reports/admin/{report['id']}/resolve", json={'status': 'resolved', 'resolution': '双方核实取消', 'outcome': 'cancel'}).status_code == 200
    final = client.get(f"/api/v1/books/{book['id']}").json()
    assert final['isSuspended']
    assert final['status'] == ('completed' if outcome == 'complete' else 'offline')


def test_free_books_cannot_have_a_paid_price(session_client):
    client = session_client
    demo_login(client)
    assert client.post('/api/v1/books', json={'title': '赠书价格校验', 'category': 'donation', 'priceCents': 100}).status_code == 422
    book = client.post('/api/v1/books', json={'title': '免费赠书校验', 'category': 'donation', 'priceCents': 0}).json()
    assert book['priceCents'] == 0 and book['category'] == 'donation'
    assert client.patch(f"/api/v1/books/{book['id']}", json={'title': book['title'], 'category': 'donation', 'price': 2}).status_code == 422


def test_demo_cover_archive_is_local_and_seed_never_overwrites_user_changes(session_client):
    from uuid import NAMESPACE_URL, UUID, uuid5
    from app.models.book_image import BookImage
    from app.models.book import Book
    client = session_client
    book_id = uuid5(NAMESPACE_URL, 'luojia-bookbridge/demo-book/calculus-1')
    images = client.get(f'/api/v1/books/{book_id}/images').json()
    assert len(images) == 1
    assert client.get(images[0]['url']).status_code == 200
    with SessionLocal() as db:
        db.get(Book, book_id).title = '用户修改过的样例，不应被重置'
        db.delete(db.get(BookImage, UUID(images[0]['id'])))
        db.commit()
    seed()
    assert client.get(f'/api/v1/books/{book_id}').json()['title'] == '用户修改过的样例，不应被重置'
    assert client.get(f'/api/v1/books/{book_id}/images').json() == []


def test_times_keep_the_same_instant_across_sqlite_and_timezone_clients(session_client):
    client = session_client
    demo_login(client, 'demo-seller')
    book = client.post('/api/v1/books', json={'title': '时区回归样例'}).json()
    assert book['createdAt'].endswith('Z')
    demo_login(client, 'demo-buyer')
    trade = client.post(f"/api/v1/books/{book['id']}/reservations", json={'proposedTime': '2026-11-09T14:30:00+08:00'}).json()
    assert trade['proposedTime'] == '2026-11-09T06:30:00Z'
    assert trade['expiresAt'].endswith('Z')
    mine = client.get('/api/v1/reservations/mine').json()
    assert next(item for item in mine if item['id'] == trade['id'])['proposedTime'] == '2026-11-09T06:30:00Z'
    demo_login(client, 'demo-admin')
    client.post(f"/api/v1/admin/books/{book['id']}/moderation", json={'suspended': True, 'reason': '时区记录校验'})
    from datetime import datetime, timedelta
    timestamp = client.get('/api/v1/admin/audit-logs').json()['items'][0]['createdAt']
    assert datetime.fromisoformat(timestamp).utcoffset() == timedelta(0)
