from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user_id
from app.db.session import get_db
from app.schemas.reservations import ReservationCreate, ReservationRead
from app.services.reservations import confirm_handover, create_reservation, list_user_reservations, to_reservation_read, update_reservation_status

router = APIRouter(tags=['reservations'])


@router.post('/books/{book_id}/reservations', response_model=ReservationRead, status_code=status.HTTP_201_CREATED)
def reserve_book(book_id: UUID, payload: ReservationCreate, db: Session = Depends(get_db), buyer_id: str = Depends(get_current_user_id)) -> ReservationRead:
    try:
        return to_reservation_read(create_reservation(db, book_id, buyer_id, payload), db)
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error


@router.get('/reservations/mine', response_model=list[ReservationRead])
def read_my_reservations(db: Session = Depends(get_db), user_id: str = Depends(get_current_user_id)) -> list[ReservationRead]:
    return [to_reservation_read(item, db) for item in list_user_reservations(db, user_id)]


def _change_reservation(reservation_id: UUID, action: str, db: Session, actor_id: str) -> ReservationRead:
    try:
        return to_reservation_read(update_reservation_status(db, reservation_id, actor_id, action), db)
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except PermissionError as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error


@router.post('/reservations/{reservation_id}/confirm', response_model=ReservationRead)
def confirm_reservation(reservation_id: UUID, db: Session = Depends(get_db), seller_id: str = Depends(get_current_user_id)) -> ReservationRead:
    return _change_reservation(reservation_id, 'confirm', db, seller_id)


@router.post('/reservations/{reservation_id}/reject', response_model=ReservationRead)
def reject_reservation(reservation_id: UUID, db: Session = Depends(get_db), seller_id: str = Depends(get_current_user_id)) -> ReservationRead:
    return _change_reservation(reservation_id, 'reject', db, seller_id)


@router.post('/reservations/{reservation_id}/cancel', response_model=ReservationRead)
def cancel_reservation(reservation_id: UUID, db: Session = Depends(get_db), buyer_id: str = Depends(get_current_user_id)) -> ReservationRead:
    return _change_reservation(reservation_id, 'cancel', db, buyer_id)


def _confirm_handover(reservation_id: UUID, role: str, db: Session, actor_id: str) -> ReservationRead:
    try:
        return to_reservation_read(confirm_handover(db, reservation_id, actor_id, role), db)
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except PermissionError as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error


@router.post('/reservations/{reservation_id}/buyer-confirm', response_model=ReservationRead)
def buyer_confirm_handover(reservation_id: UUID, db: Session = Depends(get_db), buyer_id: str = Depends(get_current_user_id)) -> ReservationRead:
    return _confirm_handover(reservation_id, 'buyer', db, buyer_id)


@router.post('/reservations/{reservation_id}/seller-confirm', response_model=ReservationRead)
def seller_confirm_handover(reservation_id: UUID, db: Session = Depends(get_db), seller_id: str = Depends(get_current_user_id)) -> ReservationRead:
    return _confirm_handover(reservation_id, 'seller', db, seller_id)


@router.post('/reservations/{reservation_id}/dispute', response_model=ReservationRead)
def dispute(reservation_id: UUID, db: Session = Depends(get_db), actor_id: str = Depends(get_current_user_id)) -> ReservationRead:
    return _change_reservation(reservation_id, 'dispute', db, actor_id)


@router.get('/reservations/{reservation_id}/contact')
def contact(reservation_id: UUID, db: Session = Depends(get_db), actor_id: str = Depends(get_current_user_id)) -> dict:
    from app.models.reservation import Reservation, ReservationStatus
    from app.models.book import Book
    from app.models.user import User
    reservation = db.get(Reservation, reservation_id)
    if not reservation:
        raise HTTPException(404, '预约不存在')
    book = db.get(Book, reservation.book_id)
    if actor_id not in {reservation.buyer_id, book.seller_id}:
        raise HTTPException(403, '仅交易双方可查看')
    if reservation.status not in {ReservationStatus.CONFIRMED, ReservationStatus.COMPLETED, ReservationStatus.DISPUTED}:
        raise HTTPException(403, '卖家接受预约后才可查看')
    other_id = book.seller_id if actor_id == reservation.buyer_id else reservation.buyer_id
    user = db.get(User, other_id)
    return {'nickname': user.nickname if user else '对方用户', 'contact': user.contact if user else None}
