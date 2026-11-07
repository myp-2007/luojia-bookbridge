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
  const apiOrigin = new URL(API_BASE_URL, window.location.origin).origin
  return images.map((image) => ({ ...image, url: image.url.startsWith('/') ? `${apiOrigin}${image.url}` : image.url }))
}

export function deleteBookImage(bookId: string, imageId: string): Promise<void> {
  return apiRequest(`/books/${bookId}/images/${imageId}`, { method: 'DELETE' })
}
export function setBookCover(bookId: string, imageId: string): Promise<BookImage[]> {
  return apiRequest(`/books/${bookId}/images/${imageId}/cover`, { method: 'POST' })
}
