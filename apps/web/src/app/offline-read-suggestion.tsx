import { useEffect, useRef, useState } from 'react'
import { Button } from '@heroui/react'
import type { Query } from '@tanstack/react-query'
import { queryClient } from '@/lib/query-client'
import { queryKeys } from '@/lib/query-keys'
import { useOnline } from '@/lib/use-online'
import { toPersianDigits } from '@/lib/utils/currency'
import { formatPersianDateTime } from '@/lib/utils/date'
import { useOfflinePackage } from '@/modules/pwa/offline-package'
import { selectReadSource, useNetworkReadSource } from '@/modules/pwa/read-source'

const slowAfter = 3_000
const failureWindow = 20_000
const requiredFailures = 3

function isEssential(query: Query, owner: string, pathname: string) {
  const path = pathname.replace(/\/$/, '')
  const [domain, read, account, detailOwner] = query.queryKey
  if (domain === 'auth' && read === 'session') return account === owner
  if (path.startsWith('/account')) return domain === 'auth' && read === 'profile' && account === owner
  if (path.startsWith('/orders/')) return domain === 'orders' && read === 'detail' && detailOwner === owner
  if (path === '/orders') return domain === 'activity-feed' && read === 'list' && account === owner
  if (path === '/plans') return domain === 'plans' && read === 'list'
  return domain === 'products' && (read === 'browse' || read === 'by-ids') && account === owner
}

function isNetworkError(error: unknown) {
  return error instanceof TypeError || (error instanceof DOMException && error.name === 'TimeoutError')
}

export function OfflineReadSuggestion({ owner, pathname }: { owner: string; pathname: string }) {
  const online = useOnline()
  const networkRead = useNetworkReadSource()
  const { active, missingImages, restoring } = useOfflinePackage()
  const [reason, setReason] = useState<'slow' | 'unreachable' | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const fulfilled = useRef(false)
  const failures = useRef(new Map<string, number>())

  useEffect(() => {
    if (dismissed || !networkRead) return
    const cache = queryClient.getQueryCache()
    let timer: number | undefined
    const essential = (query: Query) => query.isActive() && isEssential(query, owner, pathname)
    function track() {
      window.clearTimeout(timer)
      if (fulfilled.current) return
      const pending = cache.getAll().some(query => essential(query) && !query.state.dataUpdatedAt && query.state.fetchStatus === 'fetching')
      if (pending) timer = window.setTimeout(() => setReason('slow'), slowAfter)
    }
    track()
    const unsubscribe = cache.subscribe(event => {
      if (event.type !== 'updated' || !essential(event.query)) return
      const { action, query } = event
      if (query.state.fetchMeta && 'fetchMore' in query.state.fetchMeta) return
      if (action.type === 'fetch' && !query.state.dataUpdatedAt) track()
      if (action.type === 'success') {
        failures.current.clear()
        window.clearTimeout(timer)
        if (query.queryKey[1] !== queryKeys.auth.session(owner)[1]) {
          fulfilled.current = true
          setReason(null)
        } else {
          track()
        }
      }
      if ((action.type !== 'error' && action.type !== 'failed') || !isNetworkError(action.error)) return
      window.clearTimeout(timer)
      if (!fulfilled.current) {
        setReason('unreachable')
        return
      }
      const now = Date.now()
      for (const [key, started] of failures.current) if (now - started > failureWindow) failures.current.delete(key)
      if (!failures.current.has(query.queryHash)) failures.current.set(query.queryHash, now)
      if (failures.current.size >= requiredFailures) setReason('unreachable')
    })
    return () => {
      unsubscribe()
      window.clearTimeout(timer)
    }
  }, [dismissed, networkRead, owner, pathname])

  if (!networkRead || dismissed || (online && !reason)) return null
  const slow = online && reason === 'slow'
  const continueLabel = active ? 'ادامه با داده‌های ذخیره‌شده' : 'ورود محدود'
  const proceed = () => { setDismissed(true); selectReadSource('saved') }
  const wait = () => setDismissed(true)
  const retry = () => {
    setDismissed(true)
    void queryClient.refetchQueries({ type: 'active', predicate: query => isEssential(query, owner, pathname) })
  }
  return <aside className="fixed inset-x-3 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-[60] mx-auto max-w-xl space-y-2 rounded-xl border border-border bg-background p-4 shadow-lg" aria-label="گزینه‌های اتصال">
    <p role="status">{slow ? 'پاسخ سرور طول کشیده است.' : 'اتصال به سرور در دسترس نیست.'}</p>
    {active?.completedAt && <p className="text-sm text-muted">آخرین دریافت {formatPersianDateTime(active.completedAt)}</p>}
    {active && !!missingImages && <p className="text-sm text-muted">{toPersianDigits(missingImages)} تصویر روی دستگاه نیست.</p>}
    {!active && !restoring && <p className="text-sm text-muted">بستهٔ قابل‌خواندن روی دستگاه وجود ندارد.</p>}
    <div className="flex flex-wrap gap-2">
      {slow && !active ? <>
        <Button size="sm" onPress={wait}>منتظر بمانم</Button>
        <Button size="sm" variant="secondary" onPress={proceed}>{continueLabel}</Button>
      </> : <>
        <Button size="sm" onPress={proceed}>{continueLabel}</Button>
        <Button size="sm" variant="secondary" onPress={slow ? wait : retry}>{slow ? 'منتظر بمانم' : 'تلاش مجدد'}</Button>
      </>}
    </div>
  </aside>
}
