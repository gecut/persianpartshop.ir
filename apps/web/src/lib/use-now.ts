import { useEffect, useState } from 'react'

/** Current time that re-renders its consumer on a fixed interval, so render stays pure. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    const refresh = () => setNow(Date.now())
    const id = setInterval(refresh, intervalMs)
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [intervalMs])

  return now
}
