import { apiRequest } from '../../lib/api-client'
import type { Reservation } from '../../types/reservations'

const buyerHeaders = { 'X-User-Id': import.meta.env.VITE_DEV_USER_ID ?? 'demo-buyer' }

export async function fetchMyReservations(): Promise<Reservation[]> {
  return apiRequest<Reservation[]>('/reservations/mine', { headers: buyerHeaders })
}

export async function cancelReservation(reservationId: string): Promise<Reservation> {
  return apiRequest<Reservation>(`/reservations/${reservationId}/cancel`, { method: 'POST', headers: buyerHeaders })
}
