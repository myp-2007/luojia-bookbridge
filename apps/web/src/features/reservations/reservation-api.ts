import { apiRequest } from '../../lib/api-client'
import { getSignedInId } from '../auth/auth-api'
import type { Reservation } from '../../types/reservations'

export type ReservationRole = 'buyer' | 'seller'
export type ReservationAction = 'confirm' | 'reject' | 'cancel' | 'buyer-confirm' | 'seller-confirm' | 'dispute'
export function reservationUserId(_role: ReservationRole): string { return getSignedInId() }
export function fetchMyReservations(_role: ReservationRole = 'buyer'): Promise<Reservation[]> {
  return apiRequest('/reservations/mine')
}
export function changeReservation(id: string, action: ReservationAction, _role: ReservationRole): Promise<Reservation> {
  return apiRequest(`/reservations/${id}/${action}`, { method: 'POST' })
}
export function fetchContact(id: string): Promise<{ nickname: string; contact: string | null }> {
  return apiRequest(`/reservations/${id}/contact`)
}
