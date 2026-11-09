import { Alert, Button } from '@heroui/react'
import { DangerCircleIcon, RestartIcon } from '@solar-icons/react/linear'

export interface DataStatusProps { error?: unknown; hasData?: boolean; fetching?: boolean; onRetry: () => void }
export function DataStatus({ error, hasData = false, fetching = false, onRetry }: DataStatusProps) {
  const status = error ? (hasData ? 'warning' : 'danger') : 'accent'
  const title = error ? (hasData ? 'بروزرسانی انجام نشد' : 'دریافت اطلاعات ممکن نشد') : (fetching ? 'در حال بروزرسانی' : 'اطلاعات صفحه')
  const description = error ? (hasData ? 'اطلاعات قبلی نمایش داده می‌شود. برای دریافت اطلاعات تازه دوباره تلاش کنید.' : navigator.onLine ? 'لطفاً دوباره تلاش کنید.' : 'برای دریافت اطلاعات به اینترنت متصل شوید.') : (fetching ? 'لطفاً کمی صبر کنید.' : 'برای دریافت اطلاعات تازه، صفحه را بروزرسانی کنید.')

  return <Alert status={status} role={error ? 'status' : undefined} className="status-alert">
    <Alert.Indicator aria-hidden="true">{error ? <DangerCircleIcon size={20} /> : <RestartIcon size={20} />}</Alert.Indicator>
    <Alert.Content>
      <Alert.Title>{title}</Alert.Title>
      <Alert.Description>{description}</Alert.Description>
      <div className="mt-2">
        <Button size="sm" variant="secondary" isDisabled={fetching} onPress={onRetry}>{error ? 'تلاش مجدد' : 'بروزرسانی'}</Button>
      </div>
    </Alert.Content>
  </Alert>
}
