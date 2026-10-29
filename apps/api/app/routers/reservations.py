from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user_id
from app.db.session import get_db
from app.schemas.reservations import ReservationCreate, ReservationRead
from app.services.reservations import create_reservation, to_reservation_read

router = APIRouter(tags=['reservations'])


@router.post('/books/{book_id}/reservations', response_model=ReservationRead, status_code=status.HTTP_201_CREATED)
def reserve_book(book_id: UUID, payload: ReservationCreate, db: Session = Depends(get_db), buyer_id: str = Depends(get_current_user_id)) -> ReservationRead:
    try:
        return to_reservation_read(create_reservation(db, book_id, buyer_id, payload))
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
