import { apiRequest } from '../../lib/api-client'

export interface User {
  id: string; username: string | null; nickname: string; role: 'student' | 'admin'
  college: string; contact: string | null; gender: 'undisclosed' | 'male' | 'female' | 'other'
  bio: string; avatarUrl: string | null
}
export interface PublicUser { id: string; nickname: string; college: string; bio: string; avatarUrl: string | null }
export interface UserStats { published: number; reservations: number; completed: number; gifts: number }
let signedInId = ''
export function setSignedInId(id: string) { signedInId = id }
export function getSignedInId() { return signedInId }
export function getMe() { return apiRequest<User>('/me') }
export function signIn(username: string, password: string) { return apiRequest<User>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }) }
export function register(username: string, password: string, nickname: string) { return apiRequest<User>('/auth/register', { method: 'POST', body: JSON.stringify({ username, password, nickname }) }) }
export function logout() { return apiRequest('/auth/logout', { method: 'POST' }) }
export function updateProfile(profile: Partial<Pick<User, 'nickname' | 'college' | 'contact' | 'gender' | 'bio'>>) { return apiRequest<User>('/me', { method: 'PATCH', body: JSON.stringify(profile) }) }
export function uploadAvatar(file: File) { const body = new FormData(); body.append('file', file); return apiRequest<User>('/me/avatar', { method: 'POST', body }) }
export function removeAvatar() { return apiRequest<void>('/me/avatar', { method: 'DELETE' }) }
export function fetchStats() { return apiRequest<UserStats>('/me/stats') }
export function fetchPublicUser(id: string) { return apiRequest<PublicUser>(`/users/${id}`) }
export function changePassword(currentPassword: string, newPassword: string) { return apiRequest<void>('/auth/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }) }
