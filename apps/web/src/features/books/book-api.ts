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

export interface BookApiRecord {
  isbn?: string | null
  isFavorite?: boolean
  sellerActive?: boolean
  isSuspended?: boolean
  moderationReason?: string | null
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
  pickupLocation?: Book['pickupLocation']
  aiStatus: string
  createdAt: string
}

interface BookListResponse { items: BookApiRecord[]; page: number; pageSize: number; total: number }

export async function fetchBook(bookId: string): Promise<Book> {
  return toBook(await apiRequest<BookApiRecord>(`/books/${bookId}`))
}

export type BookSort = 'relevance' | 'newest' | 'price_asc' | 'price_desc'
export interface BookFilters {
  minPriceCents?: number
  maxPriceCents?: number
  condition?: string
  hasNotes?: boolean
  availableOnly: boolean
  sort: BookSort
}
export const DEFAULT_BOOK_FILTERS: BookFilters = { availableOnly: false, sort: 'relevance' }

export async function fetchBooks(query: string, category: string, filters: BookFilters, page: number) {
  const params = new URLSearchParams()
  if (query) params.set('q', query)
  if (category !== 'all') params.set('category', category)
  if (filters.minPriceCents !== undefined) params.set('min_price_cents', String(filters.minPriceCents))
  if (filters.maxPriceCents !== undefined) params.set('max_price_cents', String(filters.maxPriceCents))
  if (filters.condition) params.set('condition', filters.condition)
  if (filters.hasNotes !== undefined) params.set('has_notes', String(filters.hasNotes))
  if (filters.availableOnly) params.set('available_only', 'true')
  params.set('sort', filters.sort)
  params.set('page', String(page))
  params.set('page_size', '12')
  const response = await apiRequest<BookListResponse>(`/books?${params}`)
  return { ...response, items: response.items.map(toBook) }
}

export async function createBook(book: Book): Promise<Book> {
  const record = await apiRequest<BookApiRecord>('/books', {
    method: 'POST',
    body: JSON.stringify({
      isbn: book.isbn,
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
      pickupLocation: book.pickupLocation,
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

export function toBook(book: BookApiRecord): Book {
  return {
    id: book.id,
    isbn: book.isbn,
    isFavorite: book.isFavorite ?? false,
    sellerActive: book.sellerActive ?? true,
    createdAt: book.createdAt,
    sellerId: book.sellerId,
    coverUrl: book.coverUrl ? new URL(book.coverUrl, new URL(API_BASE_URL, window.location.origin)).href : undefined,
    description: book.description ?? undefined,
    isSuspended: book.isSuspended,
    moderationReason: book.moderationReason,
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
    pickupLocation: book.pickupLocation,
    distance: '校内',
    coverText: book.title.slice(0, 8),
    coverColor: 'linear-gradient(145deg, #2f8064, #91bd75)',
  }
}

export async function fetchAdminBooks(query: string, suspended: string, page: number) {
  const params = new URLSearchParams({ q: query, page: String(page), page_size: '10' })
  if (suspended) params.set('suspended', suspended)
  const result = await apiRequest<BookListResponse>(`/admin/books?${params}`)
  return { ...result, items: result.items.map(toBook) }
}
export async function moderateBook(id: string, suspended: boolean, reason: string): Promise<Book> {
  return toBook(await apiRequest<BookApiRecord>(`/admin/books/${id}/moderation`, {
    method: 'POST', body: JSON.stringify({ suspended, reason }),
  }))
}
export async function updateBook(book: Book): Promise<Book> {
  const result = await apiRequest<BookApiRecord>(`/books/${book.id}`, {
    method: 'PATCH', body: JSON.stringify({
      isbn: book.isbn,
      title: book.title, author: book.author, publisher: book.publisher, edition: book.edition,
      priceCents: Math.round(book.price * 100), condition: book.condition,
      hasNotes: book.tags.includes('有笔记'), description: book.description, category: book.category, pickupPoint: book.pickupPoint,
      pickupLocation: book.pickupLocation,
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

export async function fetchPersonalBooks(kind: 'mine' | 'favorites' | string, page: number) {
  const path = kind === 'mine' ? '/books/mine' : kind === 'favorites' ? '/me/favorites' : `/users/${kind}/books`
  const response = await apiRequest<BookListResponse>(`${path}?page=${page}&page_size=12`)
  return { ...response, items: response.items.map(toBook) }
}
export function toggleFavorite(id: string, saved: boolean) { return apiRequest<void>(`/books/${id}/favorite`, { method: saved ? 'DELETE' : 'POST' }) }
