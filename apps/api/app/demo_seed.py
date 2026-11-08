from sqlalchemy import select
import json
from hashlib import sha256
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5
from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models.book import Book, BookStatus, BookCategory
from app.models.book_image import BookImage
from app.models.user import User
from app.models.pickup_point import PickupPoint


def seed() -> None:
    with SessionLocal() as db:
        for uid, name, role in [('demo-buyer', '小桥', 'student'), ('demo-seller', '小珞', 'student'), ('demo-reader', '小书', 'student'), ('demo-fourth', '小林', 'student'), ('demo-admin', '演示管理员', 'admin')]:
            if not db.get(User, uid):
                db.add(User(id=uid, nickname=name, role=role, is_demo=True))
        for name in ['图书馆正门', '教学楼大厅', '校园书店门口']:
            if not db.scalar(select(PickupPoint).where(PickupPoint.name == name)):
                db.add(PickupPoint(name=name, description='演示地点，请现场确认具体位置'))
        seed_books(db)
        db.commit()


def seed_books(db) -> None:
    archive = Path(__file__).resolve().parents[3] / 'seed' / 'demo-books'
    records = json.loads((archive / 'manifest.json').read_text(encoding='utf-8'))
    storage = Path(get_settings().storage_dir)
    sellers = ['demo-seller', 'demo-buyer', 'demo-reader', 'demo-fourth']
    for index, record in enumerate(records):
        book_id = uuid5(NAMESPACE_URL, 'luojia-bookbridge/demo-book/' + record['slug'])
        # Stable IDs prevent duplicates after users edit titles. Never reset trades or deleted images.
        if db.get(Book, book_id):
            continue
        source = archive / record['cover']
        content = source.read_bytes()
        if sha256(content).hexdigest() != record['sha256']:
            raise ValueError('演示封面校验失败，请重新获取样例资料')
        book = Book(id=book_id, seller_id=sellers[index % len(sellers)], title=record['title'],
            author=record['author'], publisher=record['publisher'], edition=record['edition'],
            isbn=record['isbn'].replace('-', ''),
            price_cents=record['priceCents'], category=BookCategory(record['category']),
            condition='9成新' if index % 3 else '8成新', has_notes=index % 3 == 0,
            description='【比赛样例，非真实出售】封面和书目信息来自出版社公开目录。价格、品相及交接安排均为虚构演示数据。ISBN：' + record['isbn'],
            status=BookStatus.AVAILABLE, pickup_point=['图书馆正门', '教学楼大厅', '校园书店门口'][index % 3])
        image_id = uuid5(NAMESPACE_URL, 'luojia-bookbridge/demo-cover/' + record['slug'])
        relative = Path(str(book_id)) / (str(image_id) + '.jpg')
        target = storage / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
        db.add(book)
        db.flush()
        db.add(BookImage(id=image_id, book_id=book_id, storage_path=str(relative),
            original_name=record['slug'] + '.jpg', content_type='image/jpeg', size_bytes=len(content), sort_order=0))


if __name__ == '__main__':
    seed()
    print('Demo data ready (existing records preserved).')
