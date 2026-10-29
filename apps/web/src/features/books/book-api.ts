import { apiRequest } from '../../lib/api-client'
import type { Book, BookCategory, BookStatus } from '../../types/books'

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
