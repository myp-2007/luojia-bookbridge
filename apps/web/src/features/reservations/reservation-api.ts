import { apiRequest } from '../../lib/api-client'
import type { Reservation } from '../../types/reservations'

export type ReservationRole = 'buyer' | 'seller'
export type ReservationAction = 'confirm' | 'reject' | 'cancel' | 'buyer-confirm' | 'seller-confirm'

export function reservationUserId(role: ReservationRole): string {
  return role === 'buyer'
    ? import.meta.env.VITE_DEV_USER_ID ?? 'demo-buyer'
    : import.meta.env.VITE_DEV_SELLER_ID ?? 'demo-seller'
}

const buyerHeaders = { 'X-User-Id': reservationUserId('buyer') }

export async function fetchMyReservations(role: ReservationRole = 'buyer'): Promise<Reservation[]> {
  return apiRequest<Reservation[]>('/reservations/mine', { headers: { 'X-User-Id': reservationUserId(role) } })
}

export async function changeReservation(id: string, action: ReservationAction, role: ReservationRole): Promise<Reservation> {
  return apiRequest<Reservation>(`/reservations/${id}/${action}`, {
    method: 'POST', headers: { 'X-User-Id': reservationUserId(role) },
  })
}

export async function cancelReservation(reservationId: string): Promise<Reservation> {
  return apiRequest<Reservation>(`/reservations/${reservationId}/cancel`, { method: 'POST', headers: buyerHeaders })
}

export async function confirmBuyerHandover(reservationId: string): Promise<Reservation> {
  return apiRequest<Reservation>(`/reservations/${reservationId}/buyer-confirm`, { method: 'POST', headers: buyerHeaders })
}

export async function confirmSellerHandover(reservationId: string): Promise<Reservation> {
  return apiRequest<Reservation>(`/reservations/${reservationId}/seller-confirm`, { method: 'POST', headers: { 'X-User-Id': import.meta.env.VITE_DEV_SELLER_ID ?? 'demo-seller' } })
}
