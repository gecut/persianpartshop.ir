import { Button } from '@heroui/react'
import { match } from 'ts-pattern'
import { cn } from '@/lib/utils'

interface PwaNoticeProps {
  kind: 'install' | 'update'
  onOpen: () => void
  onDismiss: () => void
}

export function PwaNotice({ kind, onOpen, onDismiss }: PwaNoticeProps) {
  const notice = match(kind)
    .with('install', () => ({
      surface: 'bg-surface',
      title: 'پرشین‌پارت روی صفحهٔ اصلی',
      description: 'محصولات و سفارش‌هایتان را با یک لمس باز کنید.',
      action: 'نصب برنامه',
      variant: 'secondary' as const,
    }))
    .with('update', () => ({
      surface: 'bg-surface-secondary',
      title: 'نسخهٔ جدید پرشین‌پارت آماده است',
      description: 'پس از به‌روزرسانی، برنامه دوباره باز می‌شود.',
      action: 'به‌روزرسانی',
      variant: 'primary' as const,
    }))
    .exhaustive()

  return (
    <div className={cn(
      'grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-2xl border border-border p-3 text-start sm:grid-cols-[auto_minmax(0,1fr)_auto]',
      notice.surface,
    )}>
      <img src="/icon-192.png" alt="" width={42} height={42} className="size-[42px] rounded-xl" />
      <div role="status" className="min-w-0">
        <p className="text-sm font-bold leading-6 text-foreground">
          {notice.title}
        </p>
        <p className="text-xs leading-5 text-muted">
          {notice.description}
        </p>
      </div>
      <div className="col-start-2 flex flex-wrap items-center gap-1 sm:col-start-3">
        <Button size="sm" className="min-h-11 min-w-11" variant={notice.variant} onPress={onOpen}>
          {notice.action}
        </Button>
        <Button size="sm" className="min-h-11 min-w-11" variant="ghost" onPress={onDismiss}>بعداً</Button>
      </div>
    </div>
  )
}
