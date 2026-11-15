import { Button } from '@heroui/react'
import { ChevronLeftIcon } from '@/components/ui/icons'

export function PwaAccountButton() {
  return (
    <Button type="button" variant="outline" fullWidth aria-haspopup="dialog"
      className="h-auto min-h-16 justify-start gap-3 px-3 py-2 text-start"
      onPress={() => window.dispatchEvent(new Event('persianpart:pwa-open'))}>
      <img src="/icon-192.png" alt="" width={40} height={40} className="shrink-0 rounded-xl" />
      <span className="min-w-0 flex-1 whitespace-normal">
        <span className="block text-sm font-bold leading-6 text-foreground">برنامهٔ پرشین‌پارت</span>
        <span className="block text-xs leading-5 text-muted">نصب و به‌روزرسانی</span>
      </span>
      <ChevronLeftIcon aria-hidden="true" size={18} className="shrink-0 text-muted ltr:rotate-180" />
    </Button>
  )
}
