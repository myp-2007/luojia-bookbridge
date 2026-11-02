import base64
import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID
import httpx
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import select
from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models.ai_task import AITask
from app.models.book import Book
from app.models.book_image import BookImage
from app.providers.book_recognition import MockBookRecognitionProvider


class Candidate(BaseModel):
    value: str | None = Field(max_length=160)
    confidence: float = Field(ge=0, le=1, allow_inf_nan=False)


class CandidateResult(BaseModel):
    title: Candidate
    author: Candidate
    publisher: Candidate
    edition: Candidate
    warnings: list[str] = Field(default_factory=list, max_length=20)
    provider: str = 'openai-compatible'


def external_recognition(book: Book, images: list[BookImage]) -> dict:
    settings = get_settings()
    if not settings.ai_api_key or not settings.ai_model:
        raise ValueError('请配置 AI_API_KEY 和 AI_MODEL 后重试，或切换模拟模式')
    if not images:
        raise ValueError('请先上传封面图片')
    root = Path(settings.storage_dir).resolve()
    content = [{'type': 'text', 'text': '从图片提取书名title、作者author、出版社publisher、版本edition。每项为 {value:字符串或null,confidence:0到1}，另有warnings字符串数组。仅返回JSON对象，不确定内容返回null，不要猜测。'}]
    for image in images[:3]:
        path = (root / image.storage_path).resolve()
        if not path.is_relative_to(root) or not path.is_file():
            raise ValueError('图片文件不可用，请重新上传')
        encoded = base64.b64encode(path.read_bytes()).decode()
        content.append({'type': 'image_url', 'image_url': {'url': f'data:{image.content_type};base64,{encoded}'}})
    try:
        response = httpx.post(settings.ai_base_url.rstrip('/') + '/chat/completions',
            headers={'Authorization': 'Bearer ' + settings.ai_api_key.get_secret_value()},
            json={'model': settings.ai_model, 'messages': [{'role': 'user', 'content': content}], 'response_format': {'type': 'json_object'}, 'max_tokens': 1000},
            timeout=30)
        response.raise_for_status()
        value = response.json()['choices'][0]['message']['content']
        result = CandidateResult.model_validate(json.loads(value))
        result.provider = 'openai-compatible'
        return result.model_dump()
    except (httpx.HTTPError, KeyError, TypeError, json.JSONDecodeError, ValidationError) as error:
        # Provider responses and exception strings can contain secrets, never persist them.
        raise ValueError('模型请求失败或结果格式不符合要求，请检查服务配置后重试，或手动录入') from error


def run_task(task_id: UUID) -> None:
    with SessionLocal() as db:
        task = db.get(AITask, task_id)
        if not task or task.status != 'queued':
            return
        task.status = 'running'
        db.commit()
        book = db.get(Book, task.book_id)
        images = list(db.scalars(select(BookImage).where(BookImage.book_id == task.book_id)).all())
        # Release the transaction before any remote HTTP call.
        db.expunge(book)
        for image in images:
            db.expunge(image)
        db.commit()
        try:
            settings = get_settings()
            if settings.ai_provider == 'mock':
                candidate = MockBookRecognitionProvider().recognize(book)
                result = {name: vars(getattr(candidate, name)) for name in ['title', 'author', 'publisher', 'edition']}
                result.update(warnings=candidate.warnings, provider='mock')
            elif settings.ai_provider == 'openai-compatible':
                result = external_recognition(book, images)
            else:
                raise ValueError('不支持的AI_PROVIDER配置')
            task = db.get(AITask, task_id)
            task.result = result
            task.status = 'succeeded'
        except ValueError as error:
            task = db.get(AITask, task_id)
            task.status = 'failed'
            task.error = str(error)[:300]
        except Exception:
            task = db.get(AITask, task_id)
            task.status = 'failed'
            task.error = '识别任务异常，请重试或手动录入'
        task.finished_at = datetime.now(timezone.utc)
        db.commit()
