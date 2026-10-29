from dataclasses import dataclass

from app.models.book import Book


@dataclass
class RecognitionField:
    value: str | None
    confidence: float


@dataclass
class RecognitionResult:
    title: RecognitionField
    author: RecognitionField
    publisher: RecognitionField
    edition: RecognitionField
    warnings: list[str]


class MockBookRecognitionProvider:
    """Deterministic provider used for local development and competition demos."""

    def recognize(self, book: Book) -> RecognitionResult:
        warnings: list[str] = []
        if not book.publisher:
            warnings.append('未识别出版社，请发布者补充')
        if not book.edition:
            warnings.append('未识别版本，请发布者补充')
        return RecognitionResult(
            title=RecognitionField(book.title, 0.98 if book.title else 0.2),
            author=RecognitionField(book.author, 0.72 if book.author else 0.2),
            publisher=RecognitionField(book.publisher, 0.7 if book.publisher else 0.2),
            edition=RecognitionField(book.edition, 0.7 if book.edition else 0.2),
            warnings=warnings,
        )
