import { useEffect, useRef, useState } from 'react'
import { Button, Modal } from '@heroui/react'
import { useQuery } from '@tanstack/react-query'
import { SupplyPreviewInputSchema } from '@persianpart/contract'
import type { Product } from '../../types'
import { api } from '../../lib/api-client'
import { queryKeys } from '../../lib/query-keys'
import { formatToman, toPersianDigits } from '../../lib/utils/currency'
import { formatUnit } from '../../lib/utils/unit'
import { supplyDraftStore, useSupplyDraft } from './supply-request-draft'
import { useSupplySubmission } from './use-supply-submission'

export function SupplyRequestModal({ product, onClose, onSuccess, onPurchase }: { product: Product | null; onClose: () => void; onSuccess: (id: number) => void; onPurchase: () => void }) {
  const { owner, draft, persisted } = useSupplyDraft()
  const [debounced, setDebounced] = useState(draft?.requestedQuantity ?? 0)
  useEffect(() => { const timer = window.setTimeout(() => setDebounced(draft?.requestedQuantity ?? 0), 300); return () => window.clearTimeout(timer) }, [draft?.requestedQuantity, draft?.productId])
  const active = !!product && !!owner && !!draft && Number(product.id) === draft.productId
  const input = { productId: draft?.productId ?? 0, requestedQuantity: debounced }
  const preview = useQuery({ queryKey: queryKeys.supplyRequests.preview(owner, input.productId, debounced), queryFn: () => api.supplyRequest.preview(input), enabled: active && SupplyPreviewInputSchema.safeParse(input).success, retry: false, staleTime: 0 })
  useEffect(() => {
    if (!active || !draft || debounced !== draft.requestedQuantity || !preview.data) return
    if (draft.warehouseId === null && preview.data.warehouses.length === 1) supplyDraftStore.update({ warehouseId: preview.data.warehouses[0]!.id })
  }, [active, draft, debounced, preview.data])
  const mutation = useSupplySubmission(onSuccess, () => { void preview.refetch() })
  const previousKey = useRef(draft?.submissionKey)
  const resetMutation = mutation.reset
  useEffect(() => {
    if (previousKey.current !== draft?.submissionKey) { previousKey.current = draft?.submissionKey; resetMutation() }
  }, [draft?.submissionKey, resetMutation])
  if (!product || !draft || !active) return null
  const currentQuote = debounced === draft.requestedQuantity && !preview.isFetching && !preview.error ? preview.data : undefined
  const warehouseValid = currentQuote?.warehouses.some(item => item.id === draft.warehouseId) ?? false
  const quote = currentQuote?.quote
  const pallet = quote?.productType === 'tile' && quote.cartonsPerPallet ? Math.floor(quote.packageCount / quote.cartonsPerPallet) : 0
  const remainder = quote?.cartonsPerPallet ? quote.packageCount % quote.cartonsPerPallet : 0
  const exactAvailable = typeof mutation.error === 'object' && mutation.error !== null && 'code' in mutation.error && mutation.error.code === 'EXACT_STOCK_AVAILABLE'
  return <Modal.Root isOpen onOpenChange={open => { if (!open) onClose() }}>
    <Modal.Backdrop isDismissable className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center sm:p-4">
      <Modal.Container className="w-full max-w-xl"><Modal.Dialog className="bg-surface rounded-t-2xl sm:rounded-2xl max-h-[92dvh] overflow-y-auto text-start">
        <Modal.Header className="p-4"><Modal.Heading className="font-bold">درخواست تأمین {product.name}</Modal.Heading><Modal.CloseTrigger aria-label="بستن" /></Modal.Header>
        <Modal.Body className="space-y-4 p-4 pb-safe">
          <p className="text-sm text-muted">این درخواست رزرو یا خرید قطعی نیست. مجموعه حداکثر تا ۴۸ ساعت درباره امکان تأمین با شما هماهنگ می‌کند. مبلغ نمایش‌داده‌شده برآورد با قیمت فعلی است.</p>
          <label className="block text-sm">مقدار درخواستی ({product.productType === 'other' ? formatUnit(product.unit) : 'مترمربع'})
            <input type="number" min="0.01" max="1000000" step="0.01" disabled={draft.pending} value={draft.requestedQuantity || ''} onChange={event => supplyDraftStore.update({ requestedQuantity: Number(event.target.value) })} className="mt-2 w-full rounded-xl border border-border bg-surface p-3" />
          </label>
          {preview.isFetching && <p className="text-sm text-muted">در حال بررسی موجودی و منابع…</p>}
          {preview.error && <p role="alert" className="text-sm text-danger">دریافت برآورد ممکن نشد؛ دوباره تلاش کنید. <Button size="sm" variant="ghost" onPress={() => void preview.refetch()}>تلاش دوباره</Button></p>}
          {quote && <div className="rounded-xl bg-muted/10 p-3 text-sm space-y-1">
            <p>مقدار معادل بسته کامل: {toPersianDigits(quote.roundedQuantity)} {formatUnit(quote.unit)}</p>
            <p>{quote.productType === 'tile' ? (pallet ? `${toPersianDigits(pallet)} پالت${remainder ? ` و ${toPersianDigits(remainder)} کارتن` : ''}` : `${toPersianDigits(quote.packageCount)} کارتن`) : `${toPersianDigits(quote.packageCount)} ${formatUnit(quote.unit)}`}</p>
            <p>مبلغ برآوردی: {formatToman(quote.estimatedTotal)} تومان</p>
          </div>}
          {(currentQuote?.reason === 'exact_stock_available' || exactAvailable) && <div className="text-sm">موجودی قطعی برای این مقدار کافی است. <Button variant="ghost" size="sm" onPress={onPurchase}>خرید از موجودی</Button></div>}
          {currentQuote?.reason === 'no_active_source' && <p role="alert" className="text-sm text-danger">منبع تأمین فعالی در دسترس نیست.</p>}
          {currentQuote && currentQuote.warehouses.length > 0 && <label className="block text-sm">انبار تأمین
            <select disabled={draft.pending} value={draft.warehouseId ?? ''} onChange={event => supplyDraftStore.update({ warehouseId: Number(event.target.value) || null })} className="mt-2 w-full rounded-xl border border-border bg-surface p-3">
              <option value="">انتخاب انبار</option>{currentQuote.warehouses.map(warehouse => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
            </select>
          </label>}
          <label className="block text-sm">یادداشت (اختیاری)<textarea disabled={draft.pending} maxLength={2000} value={draft.notes} onChange={event => supplyDraftStore.update({ notes: event.target.value })} className="mt-2 w-full rounded-xl border border-border bg-surface p-3" /></label>
          {mutation.error && !exactAvailable && <p role="alert" className="text-sm text-danger">ثبت درخواست تأیید نشد. اگر ارتباط قطع شده، با همین فرم دوباره تلاش کنید تا ثبت تکراری نشود.</p>}
          {!persisted && <p role="alert" className="text-sm text-danger">ذخیره پیش‌نویس ممکن نیست؛ برای جلوگیری از ثبت تکراری ابتدا فضای ذخیره‌سازی را فعال کنید. <Button size="sm" variant="ghost" onPress={supplyDraftStore.retryPersist}>تلاش دوباره</Button></p>}
          {draft.pending && <p role="status" className="text-sm text-muted">ممکن است درخواست قبلی ثبت شده باشد؛ نتیجه را با همان اطلاعات پیگیری کنید.</p>}
          <Button fullWidth isDisabled={!persisted || mutation.isPending || (!draft.pending && (!currentQuote?.eligible || exactAvailable || !warehouseValid))} isPending={mutation.isPending} onPress={mutation.submit}>{draft.pending ? 'پیگیری ثبت قبلی' : 'ثبت درخواست تأمین'}</Button>
        </Modal.Body>
      </Modal.Dialog></Modal.Container>
    </Modal.Backdrop>
  </Modal.Root>
}
