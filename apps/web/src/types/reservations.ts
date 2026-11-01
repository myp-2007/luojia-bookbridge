export type ReservationStatus = 'pending' | 'confirmed' | 'rejected' | 'cancelled' | 'expired' | 'completed' | 'disputed'

export interface Reservation {
  id: string
  bookId: string
  buyerId: string
  status: ReservationStatus
  pickupPoint: string | null
  proposedTime: string | null
  expiresAt: string | null
  sellerConfirmedAt: string | null
  buyerConfirmedAt: string | null
  completedAt: string | null
  createdAt: string
}
