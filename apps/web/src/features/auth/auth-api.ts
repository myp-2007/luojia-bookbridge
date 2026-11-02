import { apiRequest } from '../../lib/api-client'

export interface User { id: string; nickname: string; role: 'student' | 'admin'; college: string; contact: string | null }
let signedInId = ''
export function setSignedInId(id: string) { signedInId = id }
export function getSignedInId() { return signedInId }
export function getMe() { return apiRequest<User>('/me') }
export function demoAccounts() { return apiRequest<Pick<User, 'id' | 'nickname' | 'role'>[]>('/auth/demo-accounts') }
export function login(userId: string) { return apiRequest<User>('/auth/dev-login', { method: 'POST', body: JSON.stringify({ userId }) }) }
export function logout() { return apiRequest('/auth/logout', { method: 'POST' }) }
export function saveProfile(nickname: string, contact: string) { return apiRequest<User>('/me', { method: 'PATCH', body: JSON.stringify({ nickname, contact }) }) }
