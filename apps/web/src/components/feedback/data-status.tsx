import { Alert, Button } from '@heroui/react'
import { DangerCircleIcon, RestartIcon } from '@solar-icons/react/linear'
import { match, P } from 'ts-pattern'

export interface DataStatusProps { error?: unknown; hasData?: boolean; fetching?: boolean; onRetry: () => void }
export function DataStatus({ error, hasData = false, fetching = false, onRetry }: DataStatusProps) {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
  const { status, title, description } = match([Boolean(error), hasData, fetching, isOnline] as const)
    .with([true, true, P._, P._], () => ({
      status: 'warning' as const,
      title: 'بروزرسانی انجام نشد',
      description: 'اطلاعات قبلی نمایش داده می‌شود. برای دریافت اطلاعات تازه دوباره تلاش کنید.',
    }))
    .with([true, false, P._, true], () => ({
      status: 'danger' as const,
      title: 'دریافت اطلاعات ممکن نشد',
      description: 'لطفاً دوباره تلاش کنید.',
    }))
    .with([true, false, P._, false], () => ({
      status: 'danger' as const,
      title: 'دریافت اطلاعات ممکن نشد',
      description: 'برای دریافت اطلاعات به اینترنت متصل شوید.',
    }))
    .with([false, P._, true, P._], () => ({
      status: 'accent' as const,
      title: 'در حال بروزرسانی',
      description: 'لطفاً کمی صبر کنید.',
    }))
    .with([false, P._, false, P._], () => ({
      status: 'accent' as const,
      title: 'اطلاعات صفحه',
      description: 'برای دریافت اطلاعات تازه، صفحه را بروزرسانی کنید.',
    }))
    .exhaustive()

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
