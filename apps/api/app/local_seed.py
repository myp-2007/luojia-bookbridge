from sqlalchemy import select
from app.db.session import SessionLocal
from app.models.pickup_point import PickupPoint


def seed():
    with SessionLocal() as db:
        for name in ['图书馆正门', '教学楼大厅', '校园书店门口']:
            if not db.scalar(select(PickupPoint.id).where(PickupPoint.name == name)):
                db.add(PickupPoint(name=name, description='请双方确认具体位置，在公共地点交接'))
        db.commit()


if __name__ == '__main__':
    seed()
    print('Local data ready; registration is available.')
