import { API_BASE_URL, apiRequest } from '../../lib/api-client'

export interface BookImage {
  id: string
  bookId: string
  originalName: string
  contentType: string
  sizeBytes: number
  url: string
  createdAt: string
}

export async function fetchBookImages(bookId: string): Promise<BookImage[]> {
  const images = await apiRequest<BookImage[]>(`/books/${bookId}/images`)
  const apiOrigin = API_BASE_URL.replace(/\/api\/v1\/?$/, '')
  return images.map((image) => ({ ...image, url: image.url.startsWith('/') ? `${apiOrigin}${image.url}` : image.url }))
}
