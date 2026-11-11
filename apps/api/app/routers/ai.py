from datetime import datetime, timedelta, timezone
from uuid import UUID
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.auth import get_current_user_id
from app.core.naming import to_camel
from app.core.dates import UTCDatetime
from app.db.session import get_db
from app.models.ai_task import AITask
from app.models.book import Book, BookStatus
from app.providers.deepseek import deepseek_keywords
from app.schemas.recommendations import RecommendationQuery, RecommendationResult
from app.services.ai_tasks import run_task
from app.services.recommendations import recommend_books

router = APIRouter(tags=['ai'])


@router.post('/ai/recommendations', response_model=RecommendationResult, responses={401: {'description': '请先登录'}})
def recommend(
    payload: RecommendationQuery, db: Session = Depends(get_db), user_id: str = Depends(get_current_user_id),
) -> RecommendationResult:
    # Do not hold the SQLite transaction while waiting for DeepSeek.
    db.rollback()
    keywords = deepseek_keywords(payload.query)
    return recommend_books(db, payload, user_id, keywords)


class TaskRead(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)
    id: UUID
    book_id: UUID
    status: str
    result: dict | None
    error: str | None
    created_at: UTCDatetime
    finished_at: UTCDatetime | None


def expire_task(task: AITask, db: Session, commit: bool = True) -> None:
    if task.status in {'queued', 'running'} and task.created_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc) - timedelta(seconds=90):
        task.status = 'failed'
        task.error = '任务中断或超时，请重试或手动录入'
        task.finished_at = datetime.now(timezone.utc)
        if commit:
            db.commit()


@router.post('/books/{book_id}/ai-tasks', response_model=TaskRead, status_code=202)
def create_task(book_id: UUID, background: BackgroundTasks, db: Session = Depends(get_db), user_id: str = Depends(get_current_user_id)):
    book = db.scalar(select(Book).where(Book.id == book_id).with_for_update())
    if not book:
        raise HTTPException(404, '书籍不存在')
    if book.seller_id != user_id:
        raise HTTPException(403, '只能识别自己的书籍')
    if book.is_suspended:
        raise HTTPException(409, '书籍受管理限制，请联系管理员核实')
    if book.status not in {BookStatus.DRAFT, BookStatus.AVAILABLE, BookStatus.OFFLINE}:
        raise HTTPException(409, '预约中或已完成的书籍不能识别修改')
    active = db.scalar(select(AITask).where(AITask.book_id == book_id, AITask.status.in_(['queued', 'running'])))
    if active:
        expire_task(active, db, commit=False)
        if active.status in {'queued', 'running'}:
            return active
    task = AITask(book_id=book_id, requested_by=user_id)
    db.add(task)
    db.commit()
    db.refresh(task)
    result = TaskRead.model_validate(task)
    # Ensure SQLite does not retain a read transaction while the background task starts.
    db.commit()
    background.add_task(run_task, result.id)
    return result


@router.get('/books/{book_id}/ai-tasks/{task_id}', response_model=TaskRead)
def read_task(book_id: UUID, task_id: UUID, db: Session = Depends(get_db), user_id: str = Depends(get_current_user_id)):
    task = db.get(AITask, task_id)
    if not task or task.book_id != book_id:
        raise HTTPException(404, '识别任务不存在')
    if task.requested_by != user_id:
        raise HTTPException(403, '只能查看自己的识别任务')
    expire_task(task, db)
    return task
