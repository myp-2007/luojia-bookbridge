import { apiRequest } from '../../lib/api-client'

export async function createReport(targetId: string, reason: string, description: string): Promise<void> {
  await apiRequest('/reports', {
    method: 'POST',
    headers: { 'X-User-Id': import.meta.env.VITE_DEV_USER_ID ?? 'demo-buyer' },
    body: JSON.stringify({ targetType: 'book', targetId, reason, description }),
  })
}
