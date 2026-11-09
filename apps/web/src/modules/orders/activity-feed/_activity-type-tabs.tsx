import { Button } from '@heroui/react'
import { PackageIcon, BoxIcon, ClockIcon } from '@/components/ui/icons'

interface ActivityTypeTabsProps {
  filter: 'all' | 'order' | 'supply'
  onSelect: (tab: 'all' | 'order' | 'supply') => void
}

export function ActivityTypeTabs({ filter, onSelect }: ActivityTypeTabsProps) {
  return (
  <div className="flex items-center gap-1.5 w-full" role="group" aria-label="نوع سوابق">
    {([
      { key: 'all', label: 'همه', icon: PackageIcon },
      { key: 'order', label: 'سفارش‌ها', icon: BoxIcon },
      { key: 'supply', label: 'درخواست‌های تأمین', icon: ClockIcon },
    ] as const).map(({ key, label, icon: Icon }) => (
      <Button
        key={key}
        variant="ghost"
        aria-pressed={filter === key}
        onPress={() => onSelect(key)}
        className={`h-18 flex-1 min-w-0 p-1.5 flex flex-col gap-1 rounded-2xl text-xs ${filter === key ? 'bg-[#252745] text-background' : 'bg-muted/5 text-muted'}`}
      >
        <Icon size={24} aria-hidden />
        <span>{label}</span>
      </Button>
    ))}
  </div>
  )
}
