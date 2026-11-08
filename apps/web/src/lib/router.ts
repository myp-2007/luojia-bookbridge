import { useSyncExternalStore } from 'react'

const subscribe = (listener: () => void) => { window.addEventListener('popstate', listener); return () => window.removeEventListener('popstate', listener) }
const snapshot = () => window.location.pathname + window.location.search
export function useLocation() { return useSyncExternalStore(subscribe, snapshot) }
export function navigate(to: string, replace = false) {
  if (!to.startsWith('/') || to.startsWith('//')) to = '/'
  const depth = window.history.state?.bookbridgeDepth ?? 0
  window.history[replace ? 'replaceState' : 'pushState']({ bookbridgeDepth: replace ? depth : depth + 1 }, '', to)
  window.dispatchEvent(new PopStateEvent('popstate'))
  window.scrollTo({ top: 0 })
}
export function goBack(fallback = '/') {
  if ((window.history.state?.bookbridgeDepth ?? 0) > 0) window.history.back()
  else navigate(fallback, true)
}
