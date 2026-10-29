from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.book import Book, BookStatus
from app.models.reservation import Reservation, ReservationStatus
from app.schemas.reservations import ReservationCreate, ReservationRead


ACTIVE_STATUSES = {ReservationStatus.PENDING, ReservationStatus.CONFIRMED}


def to_reservation_read(reservation: Reservation) -> ReservationRead:
    return ReservationRead(
        id=reservation.id,
        book_id=reservation.book_id,
        buyer_id=reservation.buyer_id,
        status=reservation.status.value,
        pickup_point=reservation.pickup_point,
        proposed_time=reservation.proposed_time,
        expires_at=reservation.expires_at,
        created_at=reservation.created_at,
    )


def create_reservation(db: Session, book_id: UUID, buyer_id: str, payload: ReservationCreate) -> Reservation:
    book = db.scalar(select(Book).where(Book.id == book_id).with_for_update())
    if book is None:
        raise LookupError('书籍不存在')
    if book.status != BookStatus.AVAILABLE:
        raise ValueError('该书当前不可预约')
    if book.seller_id == buyer_id:
        raise ValueError('不能预约自己发布的书籍')

    reservation = Reservation(
        book_id=book.id,
        buyer_id=buyer_id,
        status=ReservationStatus.PENDING,
        active_key=str(book.id),
        pickup_point=payload.pickup_point or book.pickup_point,
        proposed_time=payload.proposed_time,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    book.status = BookStatus.RESERVED
    db.add(reservation)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise ValueError('该书已被其他用户预约') from error
    db.refresh(reservation)
    return reservation


def list_user_reservations(db: Session, user_id: str) -> list[Reservation]:
    statement = select(Reservation).join(Book, Book.id == Reservation.book_id).where(or_(Reservation.buyer_id == user_id, Book.seller_id == user_id)).order_by(Reservation.created_at.desc())
    return list(db.scalars(statement).all())


def update_reservation_status(db: Session, reservation_id: UUID, actor_id: str, action: str) -> Reservation:
    reservation = db.get(Reservation, reservation_id)
    if reservation is None:
        raise LookupError('预约不存在')
    book = db.get(Book, reservation.book_id)
    if book is None:
        raise LookupError('书籍不存在')

    if action in {'confirm', 'reject'}:
        if book.seller_id != actor_id:
            raise PermissionError('只有卖家可以处理预约')
        if reservation.status != ReservationStatus.PENDING:
            raise ValueError('当前预约状态不能处理')
        next_status = ReservationStatus.CONFIRMED if action == 'confirm' else ReservationStatus.REJECTED
    elif action == 'cancel':
        if reservation.buyer_id != actor_id:
            raise PermissionError('只有买家可以取消预约')
        if reservation.status not in ACTIVE_STATUSES:
            raise ValueError('当前预约状态不能取消')
        next_status = ReservationStatus.CANCELLED
    else:
        raise ValueError('不支持的预约操作')

    reservation.status = next_status
    if next_status not in ACTIVE_STATUSES:
        reservation.active_key = None
        book.status = BookStatus.AVAILABLE
    db.commit()
    db.refresh(reservation)
    return reservation
