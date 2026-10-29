import os

os.environ['DATABASE_URL'] = 'sqlite:///./test_bookbridge.db'
os.environ['ENVIRONMENT'] = 'development'

from fastapi.testclient import TestClient

from app.db.base import Base
from app.db.session import engine
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


def test_seller_can_upload_book_image() -> None:
    with TestClient(app) as client:
        created = client.post('/api/v1/books', json={'title': '数据结构', 'price': 21}, headers={'X-User-Id': 'seller-image'}).json()
        response = client.post(
            f"/api/v1/books/{created['id']}/images",
            files={'file': ('cover.png', b'fake-png-content', 'image/png')},
            headers={'X-User-Id': 'seller-image'},
        )
        assert response.status_code == 201
        assert response.json()['contentType'] == 'image/png'
        assert response.json()['sizeBytes'] == len(b'fake-png-content')
