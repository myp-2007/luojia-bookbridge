const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

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
  const isWrite = !!init?.method && init.method.toUpperCase() !== 'GET'
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      credentials: 'include',
      signal: init?.signal ?? controller.signal,
      cache: 'no-store',
    })
    if (!response.ok) {
      const data: unknown = await response.json().catch(() => null)
      const payload = (data && typeof data === 'object' ? data : {}) as { message?: unknown; detail?: unknown; code?: unknown }
      const detail = Array.isArray(payload.detail)
        ? payload.detail.map((item) => typeof item === 'object' && item !== null && 'msg' in item ? String(item.msg) : String(item)).join('；')
        : typeof payload.detail === 'string' ? payload.detail : undefined
      const message = response.status === 422 && detail ? detail.replace(/Value error, /g, '') : typeof payload.message === 'string' ? payload.message : detail ?? '请求失败，请稍后重试'
      const code = typeof payload.code === 'string' ? payload.code : 'API_ERROR'
      if (response.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/register')) window.dispatchEvent(new Event('session-expired'))
      throw new ApiError(message, code, response.status)
    }
    if (response.status === 204) return undefined as T
    return await response.json() as T
  } catch (cause) {
    if (cause instanceof ApiError) throw cause
    if (isWrite) throw new ApiError('暂未收到提交结果，请先查看书籍或交易记录，确认后再重试', 'WRITE_RESULT_UNKNOWN', 0)
    if (controller.signal.aborted) throw new ApiError('主机响应超时，请检查连接后重试', 'REQUEST_TIMEOUT', 0)
    throw new ApiError('无法连接主机，请检查电脑服务和局域网连接', 'NETWORK_ERROR', 0)
  } finally {
    window.clearTimeout(timeout)
  }
}

export { API_BASE_URL }
