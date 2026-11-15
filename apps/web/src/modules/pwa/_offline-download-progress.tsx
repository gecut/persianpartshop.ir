import {
  BoxIcon, ChecklistIcon, DocumentTextIcon, GalleryIcon, QrCodeIcon, ShieldCheckIcon,
} from '@solar-icons/react/linear'
import { AnimatedCircularProgressBar } from '@/components/ui/animated-circular-progress-bar'
import { cn } from '@/lib/utils'
import { formatNumber, toPersianDigits } from '@/lib/utils/currency'
import type { OfflinePhase, OfflineProgress } from './_download-offline-data'
import { offlineRecoveryEnabled } from './read-source'

const stages = {
  checking: {
    label: 'بررسی دسترسی و فضا',
    shortLabel: 'دسترسی',
    description: 'اعتبار حساب و فضای آزاد دستگاه را بررسی می‌کنیم.',
    icon: ShieldCheckIcon,
    unit: 'مورد',
  },
  catalog: {
    label: offlineRecoveryEnabled ? 'دریافت داده‌های بسته' : 'دریافت کاتالوگ',
    shortLabel: offlineRecoveryEnabled ? 'داده‌های بسته' : 'کاتالوگ',
    description: offlineRecoveryEnabled
      ? 'محصولات و ابعاد، طرح‌ها، سوابق و اطلاعات حساب در یک بسته دریافت می‌شوند.'
      : 'فهرست محصولات، مشخصات و ابعاد برای جست‌وجوی آفلاین ذخیره می‌شوند.',
    icon: BoxIcon,
    unit: 'محصول',
  },
  history: {
    label: 'دریافت طرح‌ها و سوابق',
    shortLabel: 'سوابق',
    description: 'طرح‌ها، جزئیات سفارش‌ها و درخواست‌های تأمین را روی دستگاه ذخیره می‌کنیم.',
    icon: DocumentTextIcon,
    unit: 'سابقه',
  },
  qr: {
    label: 'آماده‌سازی کدهای QR',
    shortLabel: 'کد QR',
    description: 'کدهای مجاز محصولات را برای نمایش و اسکن آفلاین آماده می‌کنیم.',
    icon: QrCodeIcon,
    unit: 'کد',
  },
  images: {
    label: 'دانلود تصاویر',
    shortLabel: 'تصاویر',
    description: 'کاورها و تصاویر گالری را ذخیره می‌کنیم. تصاویر معتبرِ روی دستگاه دوباره دریافت نمی‌شوند.',
    icon: GalleryIcon,
    unit: 'تصویر',
  },
  verifying: {
    label: 'بررسی نهایی بسته',
    shortLabel: 'صحت فایل‌ها',
    description: 'صحت فایل‌ها و اعتبار دسترسی را پیش از فعال‌کردن بسته بررسی می‌کنیم.',
    icon: ChecklistIcon,
    unit: 'فایل',
  },
} satisfies Record<OfflinePhase, {
  label: string
  shortLabel: string
  description: string
  icon: typeof BoxIcon
  unit: string
}>

const visibleStages = Object.entries(stages).filter(([phase]) => !offlineRecoveryEnabled || phase !== 'history')

interface OfflineDownloadProgressProps {
  progress: OfflineProgress
  expanded?: boolean
}

export function OfflineDownloadProgress({ progress, expanded = false }: OfflineDownloadProgressProps) {
  const { phase, done, total, reused, bytes } = progress
  const { label, description, icon: Icon, unit } = stages[phase]
  const count = done ?? 0
  const percent = total !== undefined && total > 0
    ? Math.min(100, Math.floor(count / total * 100))
    : undefined
  const summary = total === 0 ? 'موردی برای آماده‌سازی نبود'
    : total !== undefined ? `${toPersianDigits(count)} از ${toPersianDigits(total)} ${unit} آماده است`
    : done !== undefined ? `${toPersianDigits(count)} ${unit} آماده است` : undefined

  return (
    <div className={cn('flex w-full flex-col items-center text-center', expanded ? 'gap-5 sm:gap-6' : 'gap-3')}>
      <div className={cn('relative grid place-items-center', expanded && 'rounded-full bg-surface shadow-sm ring-8 ring-accent/5')}>
        <AnimatedCircularProgressBar
          label={`پیشرفت مرحلهٔ ${label}`}
          percent={percent}
          valueText={percent === undefined ? undefined : summary}
          isEmpty={total === 0}
          className={expanded ? 'size-36 text-4xl font-bold sm:size-40' : 'size-24 text-2xl font-bold'}
        />
      </div>

      <div className="flex max-w-sm flex-col items-center gap-2">
        <p
          role="status"
          className={cn('inline-flex items-center gap-2 rounded-full bg-accent/8 px-3 py-1.5 font-semibold text-accent', expanded ? 'text-sm' : 'text-xs')}
        >
          <Icon aria-hidden="true" size={18} className="shrink-0" />
          {label}
        </p>
        <p className={cn('text-pretty text-muted', expanded ? 'text-sm/6' : 'text-xs/5')}>{description}</p>
      </div>

      {(summary || !!reused || !!bytes) && (
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 rounded-2xl border border-border bg-surface px-4 py-2 text-xs/5 tabular-nums text-muted">
          {summary && <span className="font-semibold text-foreground">{summary}</span>}
          {total !== undefined && total > 0 && <span>{toPersianDigits(Math.max(0, total - count))} باقی مانده</span>}
          {!!reused && <span>{toPersianDigits(reused)} تصویر از قبل موجود بود</span>}
          {!!bytes && <span>{toPersianDigits(formatNumber(bytes))} بایت تصویر جدید ذخیره شد</span>}
        </div>
      )}

      {expanded && (
        <ul aria-label="مراحل آماده‌سازی" className="flex w-full max-w-md flex-wrap justify-center gap-2">
          {visibleStages.map(([key, stage]) => (
            <li
              key={key}
              aria-current={key === phase ? 'step' : undefined}
              className={cn('flex basis-[calc((100%_-_1rem)/3)] flex-col items-center justify-center gap-1.5 rounded-xl border px-1 py-2.5 text-xs/4 sm:basis-16', key === phase
                ? 'border-accent/30 bg-accent/8 font-bold text-accent'
                : 'border-border bg-surface text-muted')}
            >
              <stage.icon aria-hidden="true" size={18} />
              {stage.shortLabel}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
