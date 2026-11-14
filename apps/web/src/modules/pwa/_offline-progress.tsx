import { useState } from 'react'
import { useAuth } from '@/modules/auth/auth-store'
import { offlineRecoveryEnabled } from './read-source'
import { Button, ProgressCircle } from '@heroui/react'
import { formatNumber, toPersianDigits } from '@/lib/utils/currency'
import { formatPersianDateTime } from '@/lib/utils/date'
import type { OfflineProgress as DownloadProgress } from './_download-offline-data'
import { offlineMaxAge } from './offline-storage'
import { inspectOfflineDownload, pauseOfflinePackage, prepareOfflinePackage, removeOfflinePackage, repairOfflinePackage, useOfflinePackage } from './offline-package'

const labels = {
  checking: 'بررسی دسترسی و فضای ذخیره‌سازی',
  catalog: 'دریافت محصولات و ابعاد',
  history: 'دریافت طرح‌ها و سوابق',
  qr: 'آماده‌سازی کدهای QR',
  images: 'دانلود تصاویر',
  verifying: 'بررسی نهایی فایل‌ها و دسترسی',
}

export function OfflineProgress({ online, detail = false }: { online: boolean; detail?: boolean }) {
  const { active, assetError, assetsReady, checkingAssets, draft, error, missingImages, progress, restoring } = useOfflinePackage()
  const { user } = useAuth()
  const [inspected, setPreview] = useState<(Awaited<ReturnType<typeof inspectOfflineDownload>> & { owner: string })>()
  const preview = inspected?.owner === user?.id ? inspected : undefined
  const [preflight, setPreflight] = useState<'pending' | 'failed' | undefined>()
  async function inspect() {
    if (!offlineRecoveryEnabled) return prepareOfflinePackage()
    if (!user) return
    setPreflight('pending')
    try {
      const estimate = await inspectOfflineDownload(!draft?.manifest || draft.manifest.expiresAt <= Date.now())
      setPreview({ ...estimate, owner: user.id })
      setPreflight(undefined)
    } catch {
      setPreflight('failed')
    }
  }
  return <section className="space-y-2 border-t border-border pt-3" aria-label="استفادهٔ آفلاین">
    {active && <p className="text-sm text-muted">
      {checkingAssets ? 'در حال بررسی بسته' : assetsReady ? 'آمادهٔ استفادهٔ آفلاین' : 'آخرین نسخهٔ ذخیره‌شده'}
      {active.completedAt && <> · {formatPersianDateTime(active.completedAt)} · معتبر تا {formatPersianDateTime(Math.min(active.completedAt + offlineMaxAge, active.accessUntil))}</>}
    </p>}
    {progress && <OfflineDownloadProgress progress={progress} />}
    {!progress && draft && <p className="text-xs text-muted">
      دانلود ناتمام است.
      {!!draft.images.length && <> {toPersianDigits(Object.keys(draft.imageSizes).length)} از {toPersianDigits(draft.images.length)} تصویر ذخیره شده است.</>}
    </p>}
    {preflight === 'failed' && <p role="alert" className="text-danger text-sm">برآورد حجم بسته ممکن نشد. دوباره تلاش کنید.</p>}
    {preview && !progress && <div className="space-y-2">
      <p>حجم کل بسته {toPersianDigits(formatNumber(preview.totalBytes))} بایت · دریافت برآوردی {toPersianDigits(formatNumber(preview.transferBytes))} بایت</p>
      <p className="text-sm text-muted">اگر از اینترنت همراه استفاده می‌کنید، این دریافت از حجم بستهٔ اینترنت شما مصرف می‌کند.</p>
      {preview.shortfall === undefined && <p className="text-sm text-muted">فضای قابل‌استفادهٔ دستگاه مشخص نیست.</p>}
      {!!preview.shortfall && <p role="alert" className="text-danger">فضای کافی در دسترس نیست. {toPersianDigits(formatNumber(preview.shortfall))} بایت فضای بیشتر نیاز است.</p>}
      <Button isDisabled={!online || !!preview.shortfall} onPress={() => {
        const { manifest } = preview
        setPreview(undefined)
        void prepareOfflinePackage(manifest)
        if (detail) window.dispatchEvent(new Event('persianpart:offline-download-started'))
      }}>تأیید و شروع دریافت</Button>
      <Button variant="ghost" onPress={() => setPreview(undefined)}>انصراف</Button>
    </div>}
    {error && <p role="alert" className="text-danger text-sm">{error}</p>}
    {active && assetError && <p role="status" className="text-sm text-muted">{missingImages ? `${toPersianDigits(missingImages)} تصویر روی دستگاه پیدا نشد.` : 'بخشی از فایل‌های اجرایی آفلاین در دسترس نیست.'}</p>}
    {!online && <p className="text-xs text-muted">برای دریافت یا به‌روزرسانی داده‌ها به اینترنت وصل شوید.</p>}
    <div className="flex flex-wrap gap-2">
      {progress ? <Button variant="secondary" onPress={pauseOfflinePackage}>مکث دانلود</Button> :
        <Button variant="secondary" isDisabled={!online || restoring || !!preview || preflight === 'pending'} isPending={preflight === 'pending'} onPress={() => void inspect()}>
          {draft ? 'ادامهٔ دانلود' : active ? 'به‌روزرسانی داده‌های آفلاین' : 'آماده‌سازی برای استفادهٔ آفلاین'}
        </Button>}
      {!preview && offlineRecoveryEnabled && active && !progress && assetError && <Button variant="secondary" isDisabled={!online || restoring}
        onPress={() => void repairOfflinePackage()}>تکمیل فایل‌های آفلاین</Button>}
      {draft && <Button variant="ghost" onPress={() => void removeOfflinePackage(false)}>لغو دانلود</Button>}
      {active && <Button variant="ghost" onPress={() => void removeOfflinePackage(true)}>حذف داده‌های آفلاین</Button>}
    </div>
  </section>
}

export function OfflineDownloadProgress({ progress }: { progress: DownloadProgress }) {
  const done = progress.done ?? 0
  const total = progress.total
  const label = labels[progress.phase]
  return <div className="space-y-2">
    <p role="status">{label}</p>
    <ProgressCircle aria-label={label} isIndeterminate={total === undefined} value={done} maxValue={Math.max(total ?? 0, 1)}
      aria-valuetext={total === undefined ? undefined : `${toPersianDigits(done)} از ${toPersianDigits(total)}`}>
      <ProgressCircle.Track><ProgressCircle.TrackCircle /><ProgressCircle.FillCircle /></ProgressCircle.Track>
    </ProgressCircle>
    {progress.done !== undefined && <p className="text-xs text-muted">
      {toPersianDigits(done)}{total !== undefined && <> از {toPersianDigits(total)}</>}
      {' '}{progress.phase === 'images' ? 'تصویر' : progress.phase === 'catalog' ? 'محصول' : progress.phase === 'history' ? 'سابقه' : 'کد'} آماده است
      {total !== undefined && <> · {toPersianDigits(Math.max(0, total - done))} باقی مانده</>}
      {!!progress.reused && <> · {toPersianDigits(progress.reused)} تصویر از قبل موجود بود</>}
    </p>}
    {!!progress.bytes && <p className="text-xs text-muted">{toPersianDigits(formatNumber(progress.bytes))} بایت تصویر جدید در این نوبت ذخیره شد</p>}
  </div>
}
