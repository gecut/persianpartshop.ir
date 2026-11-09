import { formatTrackingNumber } from '@/lib/utils/tracking-number'
import { Button, Modal } from '@heroui/react'
import { api } from '@/lib/api-client'
import { Badge } from '@/components/ui/badge'
import { formatToman, toPersianDigits } from '@/lib/utils/currency'
import { formatPersianDateTime } from '@/lib/utils/date'
import { formatUnit } from '@/lib/utils/unit'
import { getSupplyStatusColor } from './_activity-supply-card'
import type { UseQueryResult } from '@tanstack/react-query'

type SupplyRequestDetail = Awaited<ReturnType<typeof api.supplyRequest.detail>>

interface SupplyDetailModalProps {
  isOpen: boolean
  onClose: () => void
  supplyDetail: Pick<UseQueryResult<SupplyRequestDetail>, 'isPending' | 'error' | 'data'>
  isCancelling: boolean
  onCancel: (id: number) => void
}

export function SupplyDetailModal({ isOpen, onClose, supplyDetail, isCancelling, onCancel }: SupplyDetailModalProps) {
  return (
  <Modal.Root isOpen={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
    <Modal.Backdrop
      isDismissable
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center sm:p-4"
    >
      <Modal.Container className="w-full max-w-xl">
        <Modal.Dialog className="bg-surface rounded-t-2xl sm:rounded-2xl max-h-[92dvh] overflow-y-auto text-start">
          <Modal.Header className="p-4 border-b border-border flex items-center justify-between">
            <Modal.Heading className="font-bold text-base text-foreground">
              جزئیات درخواست تأمین
            </Modal.Heading>
            <Modal.CloseTrigger aria-label="بستن" />
          </Modal.Header>

          <Modal.Body className="space-y-4 p-4 pb-safe text-sm">
            {supplyDetail.isPending && <p>در حال دریافت اطلاعات درخواست…</p>}
            {supplyDetail.error && (
              <p role="alert" className="text-danger">
                دریافت اطلاعات درخواست با خطا مواجه شد.
              </p>
            )}

            {supplyDetail.data && (
              <div className="space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-border">
                  <span className="text-muted">شماره پیگیری:</span>
                  <span className="font-bold text-foreground tabular-nums" dir="ltr">
                    {formatTrackingNumber(supplyDetail.data.requestNumber)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted">نام محصول:</span>
                  <span className="font-bold text-foreground">{supplyDetail.data.productName}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted">وضعیت:</span>
                  <Badge variant={getSupplyStatusColor(supplyDetail.data.status)}>
                    {supplyDetail.data.status === 'new'
                      ? 'ثبت‌شده'
                      : supplyDetail.data.status === 'reviewing'
                        ? 'در حال بررسی'
                        : supplyDetail.data.status === 'supplied'
                          ? 'تأمین شده'
                          : supplyDetail.data.status === 'unavailable'
                            ? 'غیرقابل تأمین'
                            : 'لغو شده'}
                  </Badge>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted">مقدار درخواستی:</span>
                  <span className="font-bold text-foreground">
                    {toPersianDigits(supplyDetail.data.requestedQuantity)}{' '}
                    {formatUnit(supplyDetail.data.unit)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted">معادل بسته کامل:</span>
                  <span className="font-bold text-foreground">
                    {toPersianDigits(supplyDetail.data.roundedQuantity)}{' '}
                    {formatUnit(supplyDetail.data.unit)}
                  </span>
                </div>



                <div className="flex justify-between items-center">
                  <span className="text-muted">مبلغ برآوردی:</span>
                  <span className="font-bold text-primary">
                    {formatToman(supplyDetail.data.estimatedTotal)} تومان
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted">زمان ثبت:</span>
                  <span className="text-foreground">
                    {formatPersianDateTime(supplyDetail.data.createdAt)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted">مهلت پاسخ:</span>
                  <span className="text-foreground">
                    {formatPersianDateTime(supplyDetail.data.responseDueAt)}
                  </span>
                </div>

                {supplyDetail.data.notes && (
                  <div className="pt-2 border-t border-border">
                    <span className="text-muted block text-xs mb-1">یادداشت شما:</span>
                    <p className="p-2.5 rounded-xl bg-muted/10 text-xs text-foreground whitespace-pre-wrap">
                      {supplyDetail.data.notes}
                    </p>
                  </div>
                )}

                {supplyDetail.data.canCancel && (
                  <div className="pt-2">
                    <Button
                      fullWidth
                      variant="danger-soft"
                      isPending={isCancelling}
                      onPress={() => {
                        if (window.confirm('آیا از لغو این درخواست تأمین اطمینان دارید؟')) {
                          onCancel(supplyDetail.data!.id)
                        }
                      }}
                    >
                      لغو درخواست تأمین
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  </Modal.Root>
  )
}
