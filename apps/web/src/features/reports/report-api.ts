import { apiRequest } from '../../lib/api-client'

export async function createReport(targetId: string, reason: string, description: string): Promise<void> {
  await apiRequest('/reports', {
    method: 'POST',
    body: JSON.stringify({ targetType: 'book', targetId, reason, description }),
  })
}

export interface ReportRecord {
  id: string; targetType: string; targetId: string; reason: string; description: string
  status: string; resolution: string | null
}
export function fetchReports(admin = false): Promise<ReportRecord[]> {
  return apiRequest(admin ? '/reports/admin' : '/reports/mine')
}
export function resolveReport(id: string, resolution: string, status: 'resolved' | 'rejected', outcome?: string) {
  return apiRequest(`/reports/admin/${id}/resolve`, { method: 'POST', body: JSON.stringify({ resolution, status, outcome }) })
}
export async function reportTrade(id: string) {
  await apiRequest('/reports', { method: 'POST', body: JSON.stringify({ targetType: 'reservation', targetId: id, reason: '交接争议', description: '交易一方申请人工核实，请联系双方确认交接情况。' }) })
}
