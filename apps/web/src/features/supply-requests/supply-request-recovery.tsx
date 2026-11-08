import { Button } from '@heroui/react'
import { toast } from '../../components/feedback/toast'
import { supplyDraftStore, useSupplyDraft } from './supply-request-draft'
import { useSupplySubmission } from './use-supply-submission'

export function SupplyRequestRecovery({ onSuccess }: { onSuccess: (id: number) => void }) {
  const { draft, persisted } = useSupplyDraft()
  const submission = useSupplySubmission(onSuccess, code => {
    toast.warning('درخواست ثبت نشده است', code === 'EXACT_STOCK_AVAILABLE' ? 'اکنون موجودی قطعی برای خرید کافی است.' : 'منبع تأمین اکنون در دسترس نیست.')
  })
  if (!draft?.pending) return null
  return <div role="status" className="rounded-2xl bg-muted/10 p-3 text-sm space-y-2">
    <p>پاسخ ثبت درخواست قبلی دریافت نشده است. برای جلوگیری از ثبت تکراری، ابتدا نتیجه همان درخواست را پیگیری کنید.</p>
    {submission.error && <p role="alert">پیگیری نتیجه ممکن نشد؛ دوباره تلاش کنید.</p>}
    {!persisted && <Button size="sm" variant="ghost" onPress={supplyDraftStore.retryPersist}>ذخیره دوباره پیش‌نویس</Button>}
    <Button size="sm" isPending={submission.isPending} isDisabled={!persisted || submission.isPending} onPress={submission.submit}>پیگیری ثبت قبلی</Button>
  </div>
}
