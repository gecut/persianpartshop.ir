import { Button, ProgressBar } from '@heroui/react'
import { formatNumber, toPersianDigits } from '@/lib/utils/currency'
import { formatPersianDateTime } from '@/lib/utils/date'
import { pauseOfflinePackage, prepareOfflinePackage, removeOfflinePackage, useOfflinePackage } from './offline-package'

const labels = {
  checking: 'بررسی دسترسی و فضای ذخیره‌سازی',
  catalog: 'دریافت محصولات و ابعاد',
  history: 'دریافت طرح‌ها و سوابق',
  qr: 'آماده‌سازی کدهای QR',
  images: 'دانلود تصاویر',
  verifying: 'بررسی نهایی فایل‌ها و دسترسی',
}

export function OfflineProgress({ online }: { online: boolean }) {
  const { active, assetError, assetsReady, draft, error, progress, restoring } = useOfflinePackage()
  const done = progress?.done ?? 0
  const total = progress?.total
  const label = progress ? labels[progress.phase] : ''
  return <section className="space-y-2 border-t border-border pt-3" aria-label="استفادهٔ آفلاین">
    {active && <p className="text-sm text-muted">
      {assetsReady ? 'آمادهٔ استفادهٔ آفلاین' : 'آخرین نسخهٔ ذخیره‌شده'}
      {active.completedAt && <> · {formatPersianDateTime(active.completedAt)}</>}
    </p>}
    {progress && <>
      <p role="status">{label}</p>
      <ProgressBar aria-label={label} isIndeterminate={total === undefined} value={done} maxValue={Math.max(total ?? 0, 1)}
        aria-valuetext={total === undefined ? undefined : `${toPersianDigits(done)} از ${toPersianDigits(total)}`}>
        <ProgressBar.Track><ProgressBar.Fill /></ProgressBar.Track>
      </ProgressBar>
      {progress.done !== undefined && <p className="text-xs text-muted">
        {toPersianDigits(done)}{total !== undefined && <> از {toPersianDigits(total)}</>}
        {' '}{progress.phase === 'images' ? 'تصویر' : progress.phase === 'catalog' ? 'محصول' : progress.phase === 'history' ? 'سابقه' : 'کد'} آماده است
        {!!progress.reused && <> · {toPersianDigits(progress.reused)} تصویر از قبل موجود بود</>}
      </p>}
      {!!progress.bytes && <p className="text-xs text-muted">{toPersianDigits(formatNumber(progress.bytes))} بایت تصویر جدید در این نوبت ذخیره شد</p>}
    </>}
    {!progress && draft && <p className="text-xs text-muted">
      دانلود ناتمام است.
      {!!draft.images.length && <> {toPersianDigits(Object.keys(draft.imageSizes).length)} از {toPersianDigits(draft.images.length)} تصویر ذخیره شده است.</>}
    </p>}
    {error && <p role="alert" className="text-danger text-sm">{error}</p>}
    {active && assetError && <p role="status" className="text-sm text-muted">بخشی از فایل‌های آفلاین در دسترس نیست. بسته را دوباره آماده کنید.</p>}
    {!online && <p className="text-xs text-muted">برای دریافت یا به‌روزرسانی داده‌ها به اینترنت وصل شوید.</p>}
    <div className="flex flex-wrap gap-2">
      {progress ? <Button variant="secondary" onPress={pauseOfflinePackage}>مکث دانلود</Button> :
        <Button variant="secondary" isDisabled={!online || restoring} onPress={() => void prepareOfflinePackage()}>
          {draft ? 'ادامهٔ دانلود' : active ? 'به‌روزرسانی داده‌های آفلاین' : 'آماده‌سازی برای استفادهٔ آفلاین'}
        </Button>}
      {draft && <Button variant="ghost" onPress={() => void removeOfflinePackage(false)}>لغو دانلود</Button>}
      {active && <Button variant="ghost" onPress={() => void removeOfflinePackage(true)}>حذف داده‌های آفلاین</Button>}
    </div>
  </section>
}
