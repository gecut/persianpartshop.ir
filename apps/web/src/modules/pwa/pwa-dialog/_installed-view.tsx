import { CheckCircle2Icon } from '@/components/ui/icons'
import { DialogIntro } from './_dialog-intro'

export function InstalledView() {
  return (
    <DialogIntro title="برنامه نصب شده است"
      statusIcon={<CheckCircle2Icon aria-hidden="true" size={18} className="shrink-0 text-success" />}>
      پرشین‌پارت را از میان برنامه‌های دستگاهتان باز کنید.
    </DialogIntro>
  )
}
