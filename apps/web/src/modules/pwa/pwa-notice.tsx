import { Button } from '@heroui/react'
import { cn } from '@/lib/utils'

interface PwaNoticeProps {
  kind: 'install' | 'update'
  onOpen: () => void
  onDismiss: () => void
}

export function PwaNotice({ kind, onOpen, onDismiss }: PwaNoticeProps) {
  const isUpdate = kind === 'update'

  return (
    <div className={cn(
      'grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-2xl border border-border p-3 text-start sm:grid-cols-[auto_minmax(0,1fr)_auto]',
      isUpdate ? 'bg-surface-secondary' : 'bg-surface',
    )}>
      <img src="/icon-192.png" alt="" width={42} height={42} className="size-[42px] rounded-xl" />
      <div role="status" className="min-w-0">
        <p className="text-sm font-bold leading-6 text-foreground">
          {isUpdate ? 'نسخهٔ جدید پرشین‌پارت آماده است' : 'پرشین‌پارت روی صفحهٔ اصلی'}
        </p>
        <p className="text-xs leading-5 text-muted">
          {isUpdate ? 'پس از به‌روزرسانی، برنامه دوباره باز می‌شود.' : 'محصولات و سفارش‌هایتان را با یک لمس باز کنید.'}
        </p>
      </div>
      <div className="col-start-2 flex flex-wrap items-center gap-1 sm:col-start-3">
        <Button size="sm" className="min-h-11 min-w-11" variant={isUpdate ? 'primary' : 'secondary'} onPress={onOpen}>
          {isUpdate ? 'به‌روزرسانی' : 'نصب برنامه'}
        </Button>
        <Button size="sm" className="min-h-11 min-w-11" variant="ghost" onPress={onDismiss}>بعداً</Button>
      </div>
    </div>
  )
}
