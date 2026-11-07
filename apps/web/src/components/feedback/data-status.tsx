import { Button } from '@heroui/react'

export interface DataStatusProps { error?: unknown; hasData?: boolean; fetching?: boolean; onRetry: () => void }
export function DataStatus({ error, hasData = false, fetching = false, onRetry }: DataStatusProps) {
  return <div role={error ? 'status' : undefined} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface p-3 text-sm">
    <span>{error ? hasData ? 'بروزرسانی انجام نشد؛ اطلاعات قبلی نمایش داده می‌شود.' : navigator.onLine ? 'دریافت اطلاعات ممکن نشد؛ دوباره تلاش کنید.' : 'برای دریافت اطلاعات به اینترنت متصل شوید.' : fetching ? 'در حال بروزرسانی…' : 'اطلاعات صفحه'}</span>
    <Button size="sm" variant="secondary" isDisabled={fetching} onPress={onRetry}>{error ? 'تلاش مجدد' : 'بروزرسانی'}</Button>
  </div>
}
