import { TrackingNumber } from '../../components/ui/tracking-number'
import { useEffect, useState } from 'react'
import { Button, Modal } from '@heroui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SupplyRequest } from '@persianpart/contract'
import { api } from '../../lib/api-client'
import { queryKeys } from '../../lib/query-keys'
import { formatToman, toPersianDigits } from '../../lib/utils/currency'
import { formatPersianDateTime } from '../../lib/utils/date'
import { formatUnit } from '../../lib/utils/unit'
import { useAuth } from '../auth/auth-store'

const labels: Record<SupplyRequest['status'], string> = { new: 'ثبت‌شده', reviewing: 'در حال بررسی', supplied: 'تأمین شده', unavailable: 'غیرقابل تأمین', cancelled_by_customer: 'لغو توسط مشتری' }
function RequestSummary({ item, now }: { item: SupplyRequest; now: number }) {
  const overdue = (item.status === 'new' || item.status === 'reviewing') && now >= new Date(item.responseDueAt).getTime()
  const pallet = item.productType === 'tile' && item.cartonsPerPallet ? Math.floor(item.packageCount / item.cartonsPerPallet) : 0
  const remainder = item.cartonsPerPallet ? item.packageCount % item.cartonsPerPallet : 0
  return <div className="space-y-2 text-sm text-start">
    <div className="flex flex-wrap justify-between gap-2"><strong>{item.productName}</strong><span>{labels[item.status]}</span></div>
    <TrackingNumber value={item.requestNumber} />
    <p>درخواستی: {toPersianDigits(item.requestedQuantity)} {formatUnit(item.unit)}؛ معادل بسته کامل: {toPersianDigits(item.roundedQuantity)} {formatUnit(item.unit)}</p>
    <p>{item.productType === 'tile' ? (pallet ? `${toPersianDigits(pallet)} پالت${remainder ? ` و ${toPersianDigits(remainder)} کارتن` : ''}` : `${toPersianDigits(item.packageCount)} کارتن`) : `${toPersianDigits(item.packageCount)} ${formatUnit(item.unit)}`}</p>
    <p>برآورد زمان ثبت: {formatToman(item.estimatedTotal)} تومان</p>
    {(item.status === 'new' || item.status === 'reviewing') && <p>{overdue ? 'مهلت پاسخ گذشته' : `مهلت پاسخ: ${formatPersianDateTime(item.responseDueAt)}`}</p>}
    {item.notes && <p className="whitespace-pre-wrap break-words">یادداشت: {item.notes}</p>}
  </div>
}
export function SupplyRequestList({ requestId, onOpen, onClose }: { requestId?: number; onOpen: (id: number) => void; onClose: () => void }) {
  const { user } = useAuth()
  const owner = user ? String(user.id) : ''
  const [page, setPage] = useState(1)
  const [now, setNow] = useState(Date.now())
  const client = useQueryClient()
  useEffect(() => { const timer = window.setInterval(() => { if (document.visibilityState === 'visible') setNow(Date.now()) }, 60_000); return () => window.clearInterval(timer) }, [])
  const list = useQuery({ queryKey: queryKeys.supplyRequests.list(owner, page), queryFn: () => api.supplyRequest.list({ page, limit: 20 }), enabled: !!owner })
  const detail = useQuery({ queryKey: queryKeys.supplyRequests.detail(owner, requestId ?? 0), queryFn: () => api.supplyRequest.detail({ id: requestId! }), enabled: !!owner && !!requestId })
  const cancel = useMutation({ mutationFn: (id: number) => api.supplyRequest.cancel({ id }), onSettled: () => void client.invalidateQueries({ queryKey: queryKeys.supplyRequests.all }) })
  return <div className="space-y-3 p-3">
    {list.isPending && <p>در حال دریافت درخواست‌ها…</p>}
    {list.error && <p role="alert">دریافت درخواست‌ها ممکن نشد. <Button size="sm" variant="ghost" onPress={() => void list.refetch()}>تلاش دوباره</Button></p>}
    {list.data?.items.length === 0 && <p className="text-sm text-muted">هنوز درخواست تأمینی ثبت نکرده‌اید.</p>}
    {list.data?.items.map(item => <button key={item.id} type="button" className="block w-full rounded-2xl bg-muted/5 p-4" onClick={() => onOpen(item.id)}><RequestSummary item={item} now={now} /></button>)}
    {list.data && list.data.totalPages > 1 && <div className="flex items-center justify-between"><Button size="sm" isDisabled={page <= 1} onPress={() => setPage(page - 1)}>صفحه قبل</Button><span>{toPersianDigits(page)} از {toPersianDigits(list.data.totalPages)}</span><Button size="sm" isDisabled={page >= list.data.totalPages} onPress={() => setPage(page + 1)}>صفحه بعد</Button></div>}
    <Modal.Root isOpen={!!requestId} onOpenChange={open => { if (!open) onClose() }}><Modal.Backdrop isDismissable className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center sm:p-4"><Modal.Container className="w-full max-w-xl"><Modal.Dialog className="bg-surface rounded-t-2xl sm:rounded-2xl max-h-[92dvh] overflow-y-auto"><Modal.Header className="p-4"><Modal.Heading>جزئیات درخواست تأمین</Modal.Heading><Modal.CloseTrigger aria-label="بستن" /></Modal.Header><Modal.Body className="space-y-4 p-4 pb-safe">
      {detail.isPending && <p>در حال دریافت…</p>}{detail.error && <p role="alert">درخواست یافت نشد یا دریافت آن ممکن نیست.</p>}
      {detail.data && <><RequestSummary item={detail.data} now={now} />{detail.data.canCancel && <Button variant="danger-soft" isPending={cancel.isPending} onPress={() => { if (window.confirm('این درخواست لغو شود؟')) cancel.mutate(detail.data!.id) }}>لغو درخواست</Button>}</>}
      {cancel.error && <p role="alert">لغو درخواست ممکن نشد؛ وضعیت تازه را بررسی کنید.</p>}
    </Modal.Body></Modal.Dialog></Modal.Container></Modal.Backdrop></Modal.Root>
  </div>
}
