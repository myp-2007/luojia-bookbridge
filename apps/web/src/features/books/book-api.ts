import { apiRequest } from '../../lib/api-client'
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
  sellerId: string
  title: string
  author: string | null
  publisher: string | null
  edition: string | null
  price: number
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

export async function fetchBooks(query?: string, category?: string): Promise<Book[]> {
  const params = new URLSearchParams()
  if (query) params.set('q', query)
  if (category) params.set('category', category)
  const response = await apiRequest<BookListResponse>(`/books${params.toString() ? `?${params.toString()}` : ''}`)
  return response.items.map(toBook)
}

export async function createBook(book: Book): Promise<Book> {
  const sellerId = import.meta.env.VITE_DEV_SELLER_ID ?? 'demo-seller'
  const record = await apiRequest<BookApiRecord>('/books', {
    method: 'POST',
    headers: { 'X-User-Id': sellerId },
    body: JSON.stringify({
      title: book.title,
      author: book.author === '待补充' ? null : book.author,
      publisher: book.publisher === '待补充' ? null : book.publisher,
      edition: book.edition === '待补充' ? null : book.edition,
      price: book.price,
      condition: book.condition,
      category: book.category,
      pickupPoint: book.pickupPoint === '请选择交接点' ? null : book.pickupPoint,
    }),
  })
  return toBook(record)
}

export async function createReservation(bookId: string, pickupPoint?: string): Promise<void> {
  const buyerId = import.meta.env.VITE_DEV_USER_ID ?? 'demo-buyer'
  await apiRequest(`/books/${bookId}/reservations`, {
    method: 'POST',
    headers: { 'X-User-Id': buyerId },
    body: JSON.stringify({ pickupPoint }),
  })
}

export async function uploadBookImage(bookId: string, file: File): Promise<void> {
  const sellerId = import.meta.env.VITE_DEV_SELLER_ID ?? 'demo-seller'
  const formData = new FormData()
  formData.append('file', file)
  await apiRequest(`/books/${bookId}/images`, { method: 'POST', headers: { 'X-User-Id': sellerId }, body: formData })
}

export async function recognizeBook(bookId: string): Promise<BookRecognition> {
  const sellerId = import.meta.env.VITE_DEV_SELLER_ID ?? 'demo-seller'
  return apiRequest<BookRecognition>(`/books/${bookId}/ai-extract`, { method: 'POST', headers: { 'X-User-Id': sellerId } })
}

function toBook(book: BookApiRecord): Book {
  return {
    id: book.id,
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
