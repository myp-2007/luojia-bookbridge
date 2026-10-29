from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user_id
from app.db.session import get_db
from app.schemas.reservations import ReservationCreate, ReservationRead
from app.services.reservations import create_reservation, list_user_reservations, to_reservation_read, update_reservation_status

router = APIRouter(tags=['reservations'])


@router.post('/books/{book_id}/reservations', response_model=ReservationRead, status_code=status.HTTP_201_CREATED)
def reserve_book(book_id: UUID, payload: ReservationCreate, db: Session = Depends(get_db), buyer_id: str = Depends(get_current_user_id)) -> ReservationRead:
    try:
        return to_reservation_read(create_reservation(db, book_id, buyer_id, payload))
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error


@router.get('/reservations/mine', response_model=list[ReservationRead])
def read_my_reservations(db: Session = Depends(get_db), user_id: str = Depends(get_current_user_id)) -> list[ReservationRead]:
    return [to_reservation_read(item) for item in list_user_reservations(db, user_id)]


def _change_reservation(reservation_id: UUID, action: str, db: Session, actor_id: str) -> ReservationRead:
    try:
        return to_reservation_read(update_reservation_status(db, reservation_id, actor_id, action))
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
