import { API_BASE_URL, apiRequest } from '../../lib/api-client'
import type { Book, BookCategory, BookStatus } from '../../types/books'

export interface BookRecognition {
  title: { value: string | null; confidence: number }
  author: { value: string | null; confidence: number }
  publisher: { value: string | null; confidence: number }
  edition: { value: string | null; confidence: number }
  warnings: string[]
  provider: string
}

interface BookApiRecord {
  id: string
  coverUrl?: string | null
  sellerId: string
  title: string
  author: string | null
  publisher: string | null
  edition: string | null
  price: number
  priceCents?: number
  condition: string
  hasNotes: boolean
  description: string | null
  category: BookCategory
  status: BookStatus
  pickupPoint: string | null
  aiStatus: string
  createdAt: string
}

interface BookListResponse { items: BookApiRecord[]; page: number; pageSize: number; total: number }

export async function fetchBook(bookId: string): Promise<Book> {
  return toBook(await apiRequest<BookApiRecord>(`/books/${bookId}`))
}

export async function fetchBooks(query?: string, category?: string): Promise<Book[]> {
  const params = new URLSearchParams()
  if (query) params.set('q', query)
  if (category) params.set('category', category)
  const response = await apiRequest<BookListResponse>(`/books${params.toString() ? `?${params.toString()}` : ''}`)
  return response.items.map(toBook)
}

export async function createBook(book: Book): Promise<Book> {
  const record = await apiRequest<BookApiRecord>('/books', {
    method: 'POST',
    body: JSON.stringify({
      title: book.title,
      author: book.author === '待补充' ? null : book.author,
      publisher: book.publisher === '待补充' ? null : book.publisher,
      edition: book.edition === '待补充' ? null : book.edition,
      priceCents: Math.round(book.price * 100),
      description: book.description,
      hasNotes: book.tags.includes('有笔记'),
      condition: book.condition,
      category: book.category,
      pickupPoint: book.pickupPoint === '请选择交接点' ? null : book.pickupPoint,
    }),
  })
  return toBook(record)
}

export async function createReservation(bookId: string, pickupPoint?: string): Promise<void> {
  await apiRequest(`/books/${bookId}/reservations`, {
    method: 'POST',
    body: JSON.stringify({ pickupPoint }),
  })
}

export async function uploadBookImage(bookId: string, file: File): Promise<void> {
  const formData = new FormData()
  formData.append('file', file)
  await apiRequest(`/books/${bookId}/images`, { method: 'POST', body: formData })
}

export async function recognizeBook(bookId: string): Promise<BookRecognition> {
  return apiRequest<BookRecognition>(`/books/${bookId}/ai-extract`, { method: 'POST' })
}

function toBook(book: BookApiRecord): Book {
  return {
    id: book.id,
    sellerId: book.sellerId,
    coverUrl: book.coverUrl ? new URL(book.coverUrl, new URL(API_BASE_URL, window.location.origin)).href : undefined,
    description: book.description ?? undefined,
    title: book.title,
    author: book.author ?? '待补充',
    publisher: book.publisher ?? '待补充',
    edition: book.edition ?? '待补充',
    condition: book.condition,
    price: book.price,
    category: book.category,
    status: book.status,
    tags: book.hasNotes ? ['有笔记'] : ['教材'],
    pickupPoint: book.pickupPoint ?? '待选择交接点',
    distance: '校内',
    coverText: book.title.slice(0, 8),
    coverColor: 'linear-gradient(145deg, #2f8064, #91bd75)',
  }
}

export async function fetchMyBooks(): Promise<Book[]> {
  const result = await apiRequest<BookListResponse>('/books/mine?page_size=100')
  return result.items.map(toBook)
}
export async function updateBook(book: Book): Promise<Book> {
  const result = await apiRequest<BookApiRecord>(`/books/${book.id}`, {
    method: 'PATCH', body: JSON.stringify({
      title: book.title, author: book.author, publisher: book.publisher, edition: book.edition,
      priceCents: Math.round(book.price * 100), condition: book.condition,
      hasNotes: book.tags.includes('有笔记'), description: book.description, category: book.category, pickupPoint: book.pickupPoint,
    }),
  })
  return toBook(result)
}
export async function setBookVisibility(id: string, action: 'offline' | 'publish'): Promise<Book> {
  return toBook(await apiRequest<BookApiRecord>(`/books/${id}/${action}`, { method: 'POST' }))
}
export function fetchPickupPoints() {
  return apiRequest<{ items: { id: string; name: string }[] }>('/pickup-points')
}

export interface AITask { id: string; bookId: string; status: 'queued' | 'running' | 'succeeded' | 'failed'; result: BookRecognition | null; error: string | null }
export function createAITask(bookId: string): Promise<AITask> {
  return apiRequest(`/books/${bookId}/ai-tasks`, { method: 'POST' })
}
export function fetchAITask(bookId: string, id: string): Promise<AITask> {
  return apiRequest(`/books/${bookId}/ai-tasks/${id}`)
}
