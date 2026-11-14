import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { Button } from '@heroui/react'
import { useOnline } from '@/lib/use-online'
import { OfflineProgress } from './_offline-progress'
import { offlineMaxAge } from './offline-storage'
import { checkOfflinePackage, useOfflinePackage } from './offline-package'
import { offlineRecoveryEnabled, selectReadSource, useNetworkReadSource } from './read-source'

export function useOfflineAccountStatus() {
  const online = useOnline()
  const { active, restoring } = useOfflinePackage()
  const manifest = active?.manifest
  const expiresSoon = active?.completedAt && Math.min(active.completedAt + offlineMaxAge, active.accessUntil) - Date.now() <= 48 * 60 * 60 * 1000
  const freshness = useQuery({
    queryKey: queryKeys.offline.freshness(active?.owner ?? '', active?.scopeKey ?? '', manifest?.version ?? ''),
    queryFn: ({ signal }) => {
      if (!manifest) throw new Error('Offline manifest unavailable')
      return api.offline.status({ scopeKey: manifest.scopeKey, version: manifest.version }, { signal })
    },
    enabled: offlineRecoveryEnabled && online && !!manifest,
    retry: false,
    refetchInterval: query => query.state.data?.freshness === 'unknown' &&
      query.state.dataUpdateCount < 4 ? 15_000 : false,
  })
  return { active, restoring, expiresSoon, updateAvailable: freshness.data?.freshness === 'updateAvailable', freshness: freshness.data?.freshness }
}

export function OfflineAccountCard() {
  const online = useOnline()
  const networkRead = useNetworkReadSource()
  const { active, restoring, expiresSoon, updateAvailable, freshness } = useOfflineAccountStatus()
  if (!offlineRecoveryEnabled) return null
  return <section className="space-y-2 rounded-xl border border-border p-4" aria-label="بستهٔ آفلاین">
    <h2 className="font-semibold">بستهٔ آفلاین</h2>
    {restoring ? <p role="status">در حال بررسی بسته</p> :
      !active && <p className="text-sm text-muted">بستهٔ قابل‌خواندن روی دستگاه وجود ندارد.</p>}
    {expiresSoon ? <p role="status">مهلت استفاده از بستهٔ آفلاین رو به پایان است.</p> : null}
    {active && updateAvailable && <p role="status">نسخهٔ جدید داده‌ها در دسترس است.</p>}
    {active && (!freshness || freshness === 'unknown') && <p className="text-sm text-muted">وضعیت نسخه بررسی نشده است.</p>}
    <OfflineProgress online={online} detail />
    {active && <Button size="sm" variant="ghost" onPress={() => void checkOfflinePackage()}>بررسی بسته</Button>}
    {networkRead ? <Button variant="ghost" isDisabled={!active} onPress={() => selectReadSource('saved')}>
      امتحان حالت ذخیره‌شده
    </Button> : <Button variant="ghost" onPress={() => selectReadSource('online')}>بازگشت به نمایش آنلاین</Button>}
  </section>
}
