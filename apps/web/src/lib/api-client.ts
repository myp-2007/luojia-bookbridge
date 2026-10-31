const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1'

export class ApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(message: string, code = 'UNKNOWN_ERROR', status = 500) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (!(init?.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { message?: unknown; detail?: unknown; code?: unknown }
    const detail = Array.isArray(payload.detail)
      ? payload.detail.map((item) => typeof item === 'object' && item !== null && 'msg' in item ? String(item.msg) : String(item)).join('；')
      : typeof payload.detail === 'string' ? payload.detail : undefined
    const message = typeof payload.message === 'string' ? payload.message : detail ?? '请求失败，请稍后重试'
    const code = typeof payload.code === 'string' ? payload.code : 'API_ERROR'
    throw new ApiError(message, code, response.status)
  }

  return response.json() as Promise<T>
}

export { API_BASE_URL }
