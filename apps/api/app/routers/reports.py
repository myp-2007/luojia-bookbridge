from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import get_current_user_id, require_admin
from app.db.session import get_db
from app.models.report import Report, ReportStatus
from app.schemas.reports import ReportCreate, ReportRead, ReportResolve

router = APIRouter(prefix='/reports', tags=['reports'])


@router.post('', response_model=ReportRead, status_code=status.HTTP_201_CREATED)
def create_report(payload: ReportCreate, db: Session = Depends(get_db), reporter_id: str = Depends(get_current_user_id)) -> ReportRead:
    report = Report(reporter_id=reporter_id, target_type=payload.target_type, target_id=payload.target_id, reason=payload.reason, description=payload.description)
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


@router.get('/mine', response_model=list[ReportRead])
def read_my_reports(db: Session = Depends(get_db), reporter_id: str = Depends(get_current_user_id)) -> list[ReportRead]:
    return list(db.scalars(select(Report).where(Report.reporter_id == reporter_id).order_by(Report.created_at.desc())).all())


@router.get('/admin', response_model=list[ReportRead])
def read_all_reports(db: Session = Depends(get_db), _: str = Depends(require_admin)) -> list[ReportRead]:
    return list(db.scalars(select(Report).order_by(Report.created_at.desc())).all())


@router.post('/admin/{report_id}/resolve', response_model=ReportRead)
def resolve_report(report_id: UUID, payload: ReportResolve, db: Session = Depends(get_db), admin_id: str = Depends(require_admin)) -> ReportRead:
    report = db.get(Report, report_id)
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='反馈记录不存在')
    report.status = ReportStatus(payload.status)
    report.handler_id = admin_id
    report.resolution = payload.resolution
    report.resolved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(report)
    return report
