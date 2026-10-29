export type BookCategory = 'textbook' | 'reading' | 'donation'
export type BookStatus = 'available' | 'reserved' | 'completed' | 'offline'

export interface Book {
  id: string
  title: string
  author: string
  publisher: string
  edition: string
  condition: string
  price: number
  category: BookCategory
  status: BookStatus
  tags: string[]
  pickupPoint: string
  distance: string
  coverText: string
  coverColor: string
}
