
import { Button } from '@heroui/react'

import { useAuth } from '@/modules/auth/auth-store'
import { formatToman } from '@/lib/utils/currency'
import { Modal } from '@/components/ui/modal'
import { CheckCircle2Icon, RefreshCwIcon, StoreIcon, MapPinIcon, TomanIcon } from '@/components/ui/icons'

interface CheckoutConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  user: ReturnType<typeof useAuth>['user']
  orderNotes: string
  onOrderNotesChange: (value: string) => void
  finalTotal: number
  isSubmitting: boolean
  onSubmit: () => void
}

export function CheckoutConfirmModal({
  isOpen,
  onClose,
  user,
  orderNotes,
  onOrderNotesChange,
  finalTotal,
  isSubmitting,
  onSubmit,
}: CheckoutConfirmModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="تأیید و ثبت سفارش"
      isBottomSheetOnMobile={true}
    >
      <div className="space-y-4">
        <div className="p-3.5 bg-muted/10 rounded-2xl space-y-2 text-xs">
          <div className="flex items-center gap-2 font-bold text-foreground">
            <StoreIcon size={16} className="text-primary" />
            <span>{user?.storeName || 'پخش بازرگانی پرشین پارت'}</span>
          </div>
          <div className="flex items-start gap-2 text-muted">
            <MapPinIcon size={16} className="text-muted mt-0.5 shrink-0" />
            <span>{user?.address || 'تهران، بزرگراه فتح، انبار مرکزی'}</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-foreground mb-1 text-start">
            توضیحات سفارش (اختیاری):
          </label>
          <textarea
            rows={2}
            value={orderNotes}
            onChange={(e) => onOrderNotesChange(e.target.value)}
            placeholder="یادداشت یا هماهنگی سفارش..."
            className="w-full p-3 rounded-2xl bg-muted/5 focus:bg-muted/10 text-xs text-foreground transition-all outline-hidden"
          />
        </div>

        <div className="p-3 bg-success/15 rounded-2xl text-xs space-y-1">
          <div className="flex justify-between font-bold text-foreground">
            <span>مبلغ نهایی:</span>
            <span className="text-sm font-bold inline-flex items-center gap-1">
              <span>{formatToman(finalTotal)}</span>
              <TomanIcon className="size-3.5" />
            </span>
          </div>
          <div className="flex justify-between text-success text-xs">
            <span>شیوه پرداخت:</span>
            <span>اعتبار تجاری</span>
          </div>
        </div>

        <div className="pt-2 grid grid-cols-2 gap-3">
          <Button
            type="button"
            onPress={() => onClose()}
            className="h-10 px-4 rounded-2xl bg-muted/10 text-foreground text-xs font-bold hover:bg-muted/15 transition-colors cursor-pointer"
          >
            بازگشت به سبد
          </Button>
          <Button
            type="button"
            onPress={onSubmit}
            isDisabled={isSubmitting}
            className="h-10 px-4 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <RefreshCwIcon size={16} className="animate-spin" />
            ) : (
              <>
                <CheckCircle2Icon size={16} />
                <span>ثبت نهایی سفارش</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
