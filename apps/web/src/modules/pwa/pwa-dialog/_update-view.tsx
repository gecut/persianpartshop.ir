import { Button, ProgressBar } from '@heroui/react'
import { DialogIntro } from './_dialog-intro'

interface UpdateViewProps {
  canUpdate: boolean
  hasWrites: boolean
  busy: boolean
  error: string | null
  onUpdate: () => void
}

export function UpdateView({ canUpdate, hasWrites, busy, error, onUpdate }: UpdateViewProps) {
  return (
    <div className="space-y-3">
      <DialogIntro title="نسخهٔ جدید آماده است">
        پرشین‌پارت پس از به‌روزرسانی دوباره باز می‌شود.
      </DialogIntro>
      {hasWrites && <p role="status" className="rounded-xl bg-warning/10 p-3 text-xs leading-5 text-warning-foreground">
        منتظر بمانید تا ارسال اطلاعات در پنجره‌های برنامه تمام شود.
      </p>}
      {error && <p role="alert" className="rounded-xl bg-danger/10 p-3 text-xs leading-5 text-danger">{error}</p>}
      <Button fullWidth className="min-h-11" isDisabled={!canUpdate || hasWrites} isPending={busy} onPress={onUpdate}>
        به‌روزرسانی و باز کردن دوبارهٔ برنامه
      </Button>
      {busy && <div className="space-y-2">
        <p role="status" className="text-xs text-muted">در حال فعال‌سازی نسخهٔ جدید…</p>
        <ProgressBar isIndeterminate aria-label="فعال‌سازی نسخهٔ جدید">
          <ProgressBar.Track><ProgressBar.Fill /></ProgressBar.Track>
        </ProgressBar>
      </div>}
    </div>
  )
}
