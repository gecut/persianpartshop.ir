import { Alert, Button } from '@heroui/react'
import { ClockCircleIcon } from '@solar-icons/react/linear'
import { toast } from '@/components/feedback/toast'
import { supplyDraftStore, useSupplyDraft } from './supply-request-draft'
import { useSupplySubmission } from './use-supply-submission'

export function SupplyRequestRecovery({ onSuccess }: { onSuccess: (id: number) => void }) {
  const { draft, persisted } = useSupplyDraft()
  const submission = useSupplySubmission(onSuccess, code => {
    toast.warning('درخواست ثبت نشده است', code === 'EXACT_STOCK_AVAILABLE' ? 'اکنون موجودی قطعی برای خرید کافی است.' : 'منبع تأمین اکنون در دسترس نیست.')
  })
  if (!draft?.pending) return null
  return <Alert status="warning" role="status" className="supply-recovery-alert">
    <Alert.Indicator aria-hidden="true"><ClockCircleIcon size={20} /></Alert.Indicator>
    <Alert.Content>
      <Alert.Title>درخواست قبلی در انتظار پیگیری</Alert.Title>
      <Alert.Description>پاسخ ثبت درخواست دریافت نشده است. برای جلوگیری از ثبت تکراری، ابتدا نتیجهٔ همان درخواست را پیگیری کنید.</Alert.Description>
      {submission.error && <p role="alert" className="text-xs leading-6 text-danger">پیگیری نتیجه ممکن نشد؛ دوباره تلاش کنید.</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {!persisted && <Button size="sm" variant="secondary" onPress={supplyDraftStore.retryPersist}>ذخیرهٔ دوبارهٔ پیش‌نویس</Button>}
        <Button size="sm" variant="primary" isPending={submission.isPending} isDisabled={!draft?.pending || !persisted || submission.isPending} onPress={submission.submit}>پیگیری درخواست</Button>
      </div>
    </Alert.Content>
  </Alert>
}
