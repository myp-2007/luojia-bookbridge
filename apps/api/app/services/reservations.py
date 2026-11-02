from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.book import Book, BookStatus
from app.models.reservation import Reservation, ReservationStatus
from app.models.report import Report
from app.schemas.reservations import ReservationCreate, ReservationRead


ACTIVE_STATUSES = {ReservationStatus.PENDING, ReservationStatus.CONFIRMED}


def to_reservation_read(reservation: Reservation, db: Session) -> ReservationRead:
    book = db.get(Book, reservation.book_id)
    return ReservationRead(
        book_title=book.title if book else "书籍记录",
        seller_id=book.seller_id if book else "",
        id=reservation.id,
        book_id=reservation.book_id,
        buyer_id=reservation.buyer_id,
        status=reservation.status.value,
        pickup_point=reservation.pickup_point,
        proposed_time=reservation.proposed_time,
        expires_at=reservation.expires_at,
        seller_confirmed_at=reservation.seller_confirmed_at,
        buyer_confirmed_at=reservation.buyer_confirmed_at,
        completed_at=reservation.completed_at,
        created_at=reservation.created_at,
    )


def create_reservation(db: Session, book_id: UUID, buyer_id: str, payload: ReservationCreate) -> Reservation:
    expire_pending(db)
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
    expire_pending(db)
    statement = select(Reservation).join(Book, Book.id == Reservation.book_id).where(or_(Reservation.buyer_id == user_id, Book.seller_id == user_id)).order_by(Reservation.created_at.desc())
    return list(db.scalars(statement).all())


def update_reservation_status(db: Session, reservation_id: UUID, actor_id: str, action: str) -> Reservation:
    reservation, book = locked_reservation(db, reservation_id)

    if action in {'confirm', 'reject'}:
        if book.seller_id != actor_id:
            raise PermissionError('只有卖家可以处理预约')
        if reservation.status != ReservationStatus.PENDING:
            raise ValueError('当前预约状态不能处理')
        if reservation.expires_at and reservation.expires_at.replace(tzinfo=timezone.utc) <= datetime.now(timezone.utc):
            raise ValueError('预约已过期，请刷新')
        next_status = ReservationStatus.CONFIRMED if action == 'confirm' else ReservationStatus.REJECTED
        if action == 'confirm':
            reservation.expires_at = None
    elif action == 'cancel':
        if reservation.buyer_id != actor_id:
            raise PermissionError('只有买家可以取消预约')
        if reservation.status not in ACTIVE_STATUSES:
            raise ValueError('当前预约状态不能取消')
        if reservation.buyer_confirmed_at or reservation.seller_confirmed_at:
            raise ValueError('已有一方确认交接，请提交争议处理')
        next_status = ReservationStatus.CANCELLED
    elif action == 'dispute':
        if actor_id not in {reservation.buyer_id, book.seller_id}:
            raise PermissionError('只有交易双方可以提交争议')
        if reservation.status != ReservationStatus.CONFIRMED:
            raise ValueError('仅交接中的交易可以提交争议')
        reservation.status = ReservationStatus.DISPUTED
        db.add(Report(reporter_id=actor_id, target_type='reservation', target_id=str(reservation.id), reason='交接争议', description='交易参与者申请人工核实，请联系双方确认交接情况。'))
        db.commit()
        db.refresh(reservation)
        return reservation
    else:
        raise ValueError('不支持的预约操作')

    reservation.status = next_status
    if next_status not in ACTIVE_STATUSES:
        reservation.active_key = None
        book.status = BookStatus.AVAILABLE
    db.commit()
    db.refresh(reservation)
    return reservation


def confirm_handover(db: Session, reservation_id: UUID, actor_id: str, role: str) -> Reservation:
    """Record one party's offline handover confirmation and complete when both agree."""
    reservation, book = locked_reservation(db, reservation_id)
    expected_actor = reservation.buyer_id if role == 'buyer' else book.seller_id
    if role not in {'buyer', 'seller'} or actor_id != expected_actor:
        raise PermissionError('只能确认自己的交接状态')
    if reservation.status == ReservationStatus.COMPLETED:
        return reservation
    if reservation.status != ReservationStatus.CONFIRMED:
        raise ValueError('只有卖家确认预约后才能确认交接')

    now = datetime.now(timezone.utc)
    if role == 'buyer':
        if reservation.buyer_id != actor_id:
            raise PermissionError('只有买家可以确认买家交接')
        reservation.buyer_confirmed_at = reservation.buyer_confirmed_at or now
    elif role == 'seller':
        if book.seller_id != actor_id:
            raise PermissionError('只有卖家可以确认卖家交接')
        reservation.seller_confirmed_at = reservation.seller_confirmed_at or now
    else:
        raise ValueError('不支持的确认角色')

    if reservation.buyer_confirmed_at and reservation.seller_confirmed_at:
        reservation.status = ReservationStatus.COMPLETED
        reservation.completed_at = reservation.completed_at or now
        reservation.active_key = None
        book.status = BookStatus.COMPLETED
    db.commit()
    db.refresh(reservation)
    return reservation


def locked_reservation(db: Session, reservation_id: UUID) -> tuple[Reservation, Book]:
    existing = db.get(Reservation, reservation_id)
    if existing is None:
        raise LookupError('预约不存在')
    book = db.scalar(select(Book).where(Book.id == existing.book_id).with_for_update().execution_options(populate_existing=True))
    if book is None:
        raise LookupError('书籍不存在')
    reservation = db.scalar(select(Reservation).where(Reservation.id == reservation_id).with_for_update().execution_options(populate_existing=True))
    return reservation, book


def expire_pending(db: Session) -> None:
    now = datetime.now(timezone.utc)
    ids = db.scalars(select(Reservation.id).where(Reservation.status == ReservationStatus.PENDING, Reservation.expires_at <= now).order_by(Reservation.book_id)).all()
    for reservation_id in ids:
        reservation, book = locked_reservation(db, reservation_id)
        if reservation.status == ReservationStatus.PENDING:
            reservation.status = ReservationStatus.EXPIRED
            reservation.active_key = None
            if book.status == BookStatus.RESERVED:
                book.status = BookStatus.AVAILABLE
    if ids:
        db.commit()
