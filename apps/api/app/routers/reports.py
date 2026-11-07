from datetime import datetime, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.core.auth import get_current_user_id, require_admin
from app.core.dates import as_utc
from app.db.session import get_db
from app.models.report import Report, ReportStatus
from app.models.reservation import Reservation, ReservationStatus
from app.models.book import Book, BookStatus
from app.models.user import AuditLog
from app.models.pickup_point import PickupPoint
from app.schemas.reports import ReportCreate, ReportRead, ReportResolve
from app.services.reservations import locked_reservation

router = APIRouter(tags=['reports'])


@router.get('/pickup-points')
def points(db: Session = Depends(get_db)) -> dict:
    items = db.scalars(select(PickupPoint).where(PickupPoint.is_active.is_(True), PickupPoint.is_public.is_(True))).all()
    return {'items': [{'id': str(p.id), 'name': p.name, 'description': p.description} for p in items], 'page': 1, 'pageSize': len(items), 'total': len(items)}


@router.post('/reports', response_model=ReportRead, status_code=201)
def create_report(payload: ReportCreate, db: Session = Depends(get_db), reporter_id: str = Depends(get_current_user_id)) -> ReportRead:
    try:
        target_id = UUID(payload.target_id)
    except ValueError:
        raise HTTPException(422, '目标ID无效')
    model = {'book': Book, 'reservation': Reservation}.get(payload.target_type)
    if not model or not db.get(model, target_id):
        raise HTTPException(404, '反馈对象不存在')
    if model is Reservation:
        reservation = db.get(Reservation, target_id)
        book = db.get(Book, reservation.book_id)
        if reporter_id not in {reservation.buyer_id, book.seller_id}:
            raise HTTPException(403, '只能反馈自己的交易')
    report = Report(reporter_id=reporter_id, target_type=payload.target_type, target_id=payload.target_id, reason=payload.reason, description=payload.description)
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


@router.get('/reports/mine', response_model=list[ReportRead])
def read_my_reports(db: Session = Depends(get_db), reporter_id: str = Depends(get_current_user_id)) -> list[ReportRead]:
    return list(db.scalars(select(Report).where(Report.reporter_id == reporter_id).order_by(Report.created_at.desc())).all())


@router.get('/reports/admin', response_model=list[ReportRead])
def read_all_reports(db: Session = Depends(get_db), _: str = Depends(require_admin)) -> list[ReportRead]:
    return list(db.scalars(select(Report).order_by(Report.created_at.desc())).all())


@router.get('/admin/audit-logs')
def audit(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), db: Session = Depends(get_db), _: str = Depends(require_admin)) -> dict:
    total = db.scalar(select(func.count()).select_from(AuditLog)) or 0
    logs = db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc(), AuditLog.id.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return {'items': [{'id': str(log.id), 'actorId': log.actor_id, 'action': log.action, 'targetId': log.target_id, 'description': log.description, 'createdAt': as_utc(log.created_at)} for log in logs], 'page': page, 'pageSize': page_size, 'total': total}


@router.post('/reports/admin/{report_id}/resolve', response_model=ReportRead)
def resolve_report(report_id: UUID, payload: ReportResolve, db: Session = Depends(get_db), admin_id: str = Depends(require_admin)) -> ReportRead:
    # Acquire book/reservation before report to keep the transaction lock order consistent.
    reservation = book = None
    if payload.outcome:
        initial = db.get(Report, report_id)
        if not initial or initial.target_type != 'reservation':
            raise HTTPException(409, '该反馈没有关联交易')
        try:
            reservation, book = locked_reservation(db, UUID(initial.target_id))
        except LookupError:
            raise HTTPException(404, '交易不存在')
    report = db.scalar(select(Report).where(Report.id == report_id).with_for_update().execution_options(populate_existing=True))
    if not report:
        raise HTTPException(404, '反馈记录不存在')
    if report.status in {ReportStatus.RESOLVED, ReportStatus.REJECTED}:
        raise HTTPException(409, '反馈已处理，请刷新')
    if payload.outcome:
        if payload.status != 'resolved' or reservation.status != ReservationStatus.DISPUTED:
            raise HTTPException(409, '仅可对争议交易作出处理')
        if payload.outcome == 'complete':
            now = datetime.now(timezone.utc)
            reservation.buyer_confirmed_at = reservation.buyer_confirmed_at or now
            reservation.seller_confirmed_at = reservation.seller_confirmed_at or now
            reservation.completed_at = now
            reservation.status = ReservationStatus.COMPLETED
            book.status = BookStatus.COMPLETED
        else:
            reservation.status = ReservationStatus.CANCELLED
            book.status = BookStatus.OFFLINE if book.is_suspended else BookStatus.AVAILABLE
        reservation.active_key = None
    report.status = ReportStatus(payload.status)
    report.handler_id = admin_id
    report.resolution = payload.resolution
    report.resolved_at = datetime.now(timezone.utc)
    db.add(AuditLog(actor_id=admin_id, action='resolve_report', target_id=str(report_id), description=payload.resolution + (' / ' + payload.outcome if payload.outcome else '')))
    db.commit()
    db.refresh(report)
    return report
