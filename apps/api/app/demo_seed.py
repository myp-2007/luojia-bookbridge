from sqlalchemy import select
from app.db.session import SessionLocal
from app.models.book import Book, BookStatus
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
        for title, price in [('高等数学（第七版）', 2200), ('C 语言程序设计', 1800), ('大学英语', 1500), ('线性代数', 1600)]:
            if not db.scalar(select(Book).where(Book.seller_id == 'demo-seller', Book.title == title)):
                db.add(Book(seller_id='demo-seller', title=title, price_cents=price, condition='9成新', status=BookStatus.AVAILABLE, pickup_point='图书馆正门'))
        db.commit()


if __name__ == '__main__':
    seed()
    print('Demo data ready (existing records preserved).')
