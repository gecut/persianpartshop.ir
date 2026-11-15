import { useId, useState } from 'react'
import { match } from 'ts-pattern'
import { useAuth } from '@/modules/auth/auth-store'
import { offlineRecoveryEnabled } from './read-source'
import { Button } from '@heroui/react'
import { DownloadMinimalisticIcon } from '@solar-icons/react/linear'
import { formatNumber, toPersianDigits } from '@/lib/utils/currency'
import { formatPersianDateTime } from '@/lib/utils/date'
import { OfflineDownloadProgress } from './_offline-download-progress'
import { offlineMaxAge } from './offline-storage'
import { inspectOfflineDownload, pauseOfflinePackage, prepareOfflinePackage, removeOfflinePackage, repairOfflinePackage, useOfflinePackage } from './offline-package'

export function OfflineProgress({ online, detail = false, showHeading = false }: {
  online: boolean
  detail?: boolean
  showHeading?: boolean
}) {
  const { active, assetError, assetsReady, checkingAssets, draft, error, missingImages, progress, restoring } = useOfflinePackage()
  const { user } = useAuth()
  const [inspected, setPreview] = useState<(Awaited<ReturnType<typeof inspectOfflineDownload>> & { owner: string })>()
  const preview = inspected?.owner === user?.id ? inspected : undefined
  const [preflight, setPreflight] = useState<'pending' | 'failed' | undefined>()
  const downloadDescriptionId = useId()
  const showDownloadDescription = !active && !draft && !progress && !preview
  const packageStatus = match({ checkingAssets, assetsReady })
    .with({ checkingAssets: true }, () => 'در حال بررسی بسته')
    .with({ assetsReady: true }, () => 'آمادهٔ استفادهٔ آفلاین')
    .otherwise(() => 'آخرین نسخهٔ ذخیره‌شده')
  const downloadAction = match({ hasDraft: !!draft, hasActive: !!active })
    .with({ hasDraft: true }, () => 'ادامهٔ دانلود')
    .with({ hasActive: true }, () => 'به‌روزرسانی داده‌های آفلاین')
    .otherwise(() => offlineRecoveryEnabled ? 'بررسی حجم بستهٔ آفلاین' : 'دانلود بستهٔ آفلاین')

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
  return <section className={`space-y-2 border-t border-border ${showHeading ? 'pt-2' : 'pt-3'}`} aria-label="استفادهٔ آفلاین">
    {showHeading && <h3 className="text-sm font-semibold text-foreground">استفادهٔ آفلاین</h3>}
    {showDownloadDescription && <p id={downloadDescriptionId} className="text-xs leading-5 text-muted">
      محصولات، تصاویر و سوابق سفارش روی این دستگاه ذخیره می‌شوند تا بدون اینترنت هم در دسترس باشند.
    </p>}
    {active && <p className="text-sm text-muted">
      {packageStatus}
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
        <Button variant="outline" fullWidth={showHeading} className="h-auto min-h-11 gap-2 px-3 py-2 whitespace-normal"
          aria-describedby={showDownloadDescription ? downloadDescriptionId : undefined}
          isDisabled={!online || restoring || !!preview || preflight === 'pending'} isPending={preflight === 'pending'} onPress={() => void inspect()}>
          <DownloadMinimalisticIcon aria-hidden="true" size={18} className="shrink-0" />
          {downloadAction}
        </Button>}
      {!preview && offlineRecoveryEnabled && active && !progress && assetError && <Button variant="secondary" isDisabled={!online || restoring}
        onPress={() => void repairOfflinePackage()}>تکمیل فایل‌های آفلاین</Button>}
      {draft && <Button variant="ghost" onPress={() => void removeOfflinePackage(false)}>لغو دانلود</Button>}
      {active && <Button variant="ghost" onPress={() => void removeOfflinePackage(true)}>حذف داده‌های آفلاین</Button>}
    </div>
  </section>
}
