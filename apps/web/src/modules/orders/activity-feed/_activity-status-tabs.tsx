import { Button } from '@heroui/react'
import type { OrderStatus } from '@persianpart/contract'
import { PackageIcon, ClockIcon, CheckCircle2Icon, AlertCircleIcon } from '@/components/ui/icons'

interface ActivityStatusTabsProps {
  orderStatus: OrderStatus | undefined
  onSelect: (status?: OrderStatus) => void
}

export function ActivityStatusTabs({ orderStatus, onSelect }: ActivityStatusTabsProps) {
  return (
  <div className="flex items-center gap-1.5 w-full" role="group" aria-label="وضعیت سفارش">
    {([
      { key: undefined, label: 'همه سفارش‌ها', icon: PackageIcon },
      { key: 'pending', label: 'در حال بررسی', icon: ClockIcon },
      { key: 'completed', label: 'تکمیل شده', icon: CheckCircle2Icon },
      { key: 'cancel', label: 'لغو شده', icon: AlertCircleIcon },
    ] as const).map(({ key, label, icon: Icon }) => (
      <Button key={key ?? 'all'} variant="ghost"
        aria-pressed={orderStatus === key} onPress={() => onSelect(key)}
        className={`h-18 flex-1 min-w-0 p-1.5 flex flex-col gap-1 rounded-2xl text-[10.5px] sm:text-xs ${orderStatus === key ? 'bg-control-emphasis text-background' : 'bg-muted/5 text-muted'}`}>
        <Icon size={24} aria-hidden /><span>{label}</span>
      </Button>
    ))}
  </div>
  )
}
