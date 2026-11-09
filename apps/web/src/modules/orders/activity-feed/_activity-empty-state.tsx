import { PackageIcon } from '@/components/ui/icons'

interface ActivityEmptyStateProps {
  filter: 'all' | 'order' | 'supply'
}

export function ActivityEmptyState({ filter }: ActivityEmptyStateProps) {
  return (
    <div className="bg-muted/5 rounded-2xl p-8 text-center space-y-2.5">
      <div className="w-12 h-12 rounded-2xl bg-muted/10 text-muted flex items-center justify-center mx-auto">
        <PackageIcon size={24} />
      </div>
      <h3 className="text-sm font-bold text-foreground">موردی یافت نشد</h3>
      <p className="text-xs text-muted">
        {filter === 'order'
          ? 'هنوز سفارشی ثبت نشده است.'
          : filter === 'supply'
            ? 'هنوز درخواست تأمینی ثبت نشده است.'
            : 'هنوز فعالیتی ثبت نشده است.'}
      </p>
    </div>
  )
}
