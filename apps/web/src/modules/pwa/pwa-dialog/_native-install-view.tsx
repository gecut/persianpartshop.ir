import { Button } from '@heroui/react'
import { DialogIntro } from './_dialog-intro'

interface NativeInstallViewProps {
  installing: boolean
  onInstall: () => void
}

export function NativeInstallView({ installing, onInstall }: NativeInstallViewProps) {
  return (
    <div className="space-y-3">
      <DialogIntro title="نصب پرشین‌پارت">
        برنامه را روی دستگاهتان نصب کنید تا مستقیماً از صفحهٔ اصلی باز شود.
      </DialogIntro>
      <Button fullWidth className="min-h-11" isPending={installing} onPress={onInstall}>
        نصب پرشین‌پارت
      </Button>
      {installing && <p role="status" className="text-xs text-muted">در انتظار پاسخ مرورگر…</p>}
    </div>
  )
}
