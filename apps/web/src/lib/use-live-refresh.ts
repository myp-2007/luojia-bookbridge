import { useEffect } from 'react'

export const LIVE_REFRESH_MS = 5000

// Each visible view has one request in flight. Cleanup invalidates late results
// after a user changes a filter, switches accounts, or closes the view.
export function useLiveRefresh(
  refresh: (isCurrent: () => boolean) => Promise<void>,
  enabled: boolean,
  revision = 0,
) {
  useEffect(() => {
    if (!enabled) return
    let active = true
    let running = false
    let timer: ReturnType<typeof setTimeout> | undefined

    async function run() {
      clearTimeout(timer)
      if (!active || running) return
      // A local host may still be reachable when the browser reports no internet.
      if (document.visibilityState === 'hidden') return
      running = true
      try {
        await refresh(() => active)
      } finally {
        running = false
        if (active) timer = setTimeout(run, LIVE_REFRESH_MS)
      }
    }

    function wake() { void run() }
    wake()
    window.addEventListener('online', wake)
    window.addEventListener('focus', wake)
    document.addEventListener('visibilitychange', wake)
    return () => {
      active = false
      clearTimeout(timer)
      window.removeEventListener('online', wake)
      window.removeEventListener('focus', wake)
      document.removeEventListener('visibilitychange', wake)
    }
  }, [refresh, enabled, revision])
}
