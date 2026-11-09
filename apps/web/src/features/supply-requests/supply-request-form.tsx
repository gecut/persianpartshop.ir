import { CheckoutActionFooter } from '../checkout/checkout-action-footer'
import { CheckoutCommit } from '../checkout/checkout-commit'
import { ArrowLeftIcon, PencilIcon, TomanIcon } from '../../components/ui/icons'
import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@heroui/react'
import { SupplyPreviewInputSchema } from '@persianpart/contract'
import { api } from '../../lib/api-client'
import { queryKeys } from '../../lib/query-keys'
import { formatToman, toPersianDigits } from '../../lib/utils/currency'
import { formatCartons, formatUnit } from '../../lib/utils/unit'
import { useCatalogProduct } from '../products/catalog-data'
import { isProductAllowedForUser, useAuth } from '../auth/auth-store'
import { selectionStore } from '../products/selection-store'
import { supplyDraftStore, useSupplyDraft } from './supply-request-draft'
import { useSupplySubmission } from './use-supply-submission'

type Preview = Awaited<ReturnType<typeof api.supplyRequest.preview>>
interface SupplyRequestFormProps {
  productId: number
  presentation: 'page' | 'modal'
  onSuccess: (id: number) => void
  onPurchase: () => void
}

export function SupplyRequestForm({ productId, presentation, onSuccess, onPurchase }: SupplyRequestFormProps) {
  const { user } = useAuth()
  const { owner, draft, persisted } = useSupplyDraft()
  const client = useQueryClient()
  const productQuery = useCatalogProduct(productId)
  const product = productQuery.data
  const allowed = !!product && isProductAllowedForUser(product, user) && !user?.disableOrdering && !user?.hideExactStock
  const active = allowed && !!owner && draft?.productId === productId
  const initialized = useRef('')
  useEffect(() => {
    const identity = `${owner}:${productId}`
    if (!owner || !allowed || initialized.current === identity) return
    initialized.current = identity
    if (!supplyDraftStore.getSnapshot().draft) supplyDraftStore.open(productId)
  }, [owner, productId, allowed])

  const [debounced, setDebounced] = useState(0)
  useEffect(() => { const timer = window.setTimeout(() => setDebounced(draft?.requestedQuantity ?? 0), 300); return () => window.clearTimeout(timer) }, [draft?.requestedQuantity, draft?.productId])
  const input = { productId, requestedQuantity: debounced }
  const preview = useQuery({ queryKey: queryKeys.supplyRequests.preview(owner, productId, debounced), queryFn: ({ signal }) => api.supplyRequest.preview(input, { signal }), enabled: active && SupplyPreviewInputSchema.safeParse(input).success, retry: false, staleTime: 0 })
  const [review, setReview] = useState<{ owner: string; key: string; data: Preview } | null>(null)
  const [checking, setChecking] = useState(false)
  const [checkError, setCheckError] = useState(false)
  const [exactAvailable, setExactAvailable] = useState(false)
  const mutation = useSupplySubmission(onSuccess, code => { setReview(null); setExactAvailable(code === 'EXACT_STOCK_AVAILABLE'); void preview.refetch() })
  const previousKey = useRef(draft?.submissionKey)
  const resetMutation = mutation.reset
  useEffect(() => {
    if (previousKey.current !== draft?.submissionKey) {
      previousKey.current = draft?.submissionKey
      setReview(null); setCheckError(false); setExactAvailable(false); resetMutation()
    }
  }, [draft?.submissionKey, resetMutation])

  const current = debounced === draft?.requestedQuantity && !preview.isFetching && !preview.error ? preview.data : undefined
  const reviewing = !!review && review.owner === owner && review.key === draft?.submissionKey
  const quote = reviewing ? review.data.quote : current?.quote
  const valid = SupplyPreviewInputSchema.safeParse({ productId, requestedQuantity: draft?.requestedQuantity }).success
  const confirm = async () => {
    if (!active || !draft || !valid || !persisted || checking) return
    const key = draft.submissionKey
    setChecking(true); setCheckError(false)
    try {
      const data = await client.fetchQuery({ queryKey: queryKeys.supplyRequests.preview(owner, productId, draft.requestedQuantity), queryFn: () => api.supplyRequest.preview({ productId, requestedQuantity: draft.requestedQuantity }), staleTime: 0, retry: false })
      const latest = supplyDraftStore.getSnapshot()
      if (latest.owner !== owner || latest.draft?.submissionKey !== key) return
      setExactAvailable(data.reason === 'exact_stock_available')
      if (data.eligible) setReview({ owner, key, data })
    } catch { setCheckError(true) } finally { setChecking(false) }
  }

  if (!Number.isSafeInteger(productId) || productId <= 0) return <p role="alert">شناسهٔ محصول معتبر نیست.</p>
  if (productQuery.isPending) return <p role="status" className="text-sm text-muted">در حال دریافت اطلاعات محصول…</p>
  if (!allowed || !product || productQuery.error) return <p role="alert">دریافت محصول یا ثبت درخواست برای این حساب ممکن نیست. {productQuery.error && <Button variant="ghost" onPress={() => void productQuery.refetch()}>تلاش دوباره</Button>}</p>
  if (!active || !draft) return <div className="text-sm space-y-3"><p>پیش‌نویس دیگری در جریان است.</p><Button onPress={() => supplyDraftStore.open(productId)}>انتخاب این محصول</Button></div>
  const unit = product.productType === 'other' ? formatUnit(product.unit) : 'مترمربع'
  const quantityAdjusted = !!quote && quote.roundedQuantity !== quote.requestedQuantity
  const purchase = async () => {
    const existing = selectionStore.getSnapshot().quantities[product.id]
    if (existing !== undefined && existing !== draft.requestedQuantity && !window.confirm('مقدار این کالا در سبد خرید جایگزین شود؟')) return
    await selectionStore.setQuantity(product.id, draft.requestedQuantity)
    if (selectionStore.getSnapshot().quantities[product.id] === draft.requestedQuantity) {
      if (presentation === 'page') supplyDraftStore.clearIfCurrent(owner, draft.submissionKey)
      onPurchase()
    }
  }
  const submissionDisabled = !persisted || checking || mutation.isPending
  const canContinue = valid && !!current?.eligible && !exactAvailable && !checkError
  const submit = async () => {
    const latest = supplyDraftStore.getSnapshot()
    if (latest.owner !== owner || latest.draft?.submissionKey !== draft.submissionKey || (!latest.draft.pending && !reviewing)) throw new Error('اطلاعات درخواست تغییر کرده است؛ دوباره بررسی کنید.')
    await mutation.submit()
  }
  return <div className={presentation === 'modal' ? 'flex min-h-0 flex-1 flex-col' : undefined}>
    <div className={presentation === 'modal' ? 'min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 text-start' : 'space-y-4 text-start'}>
    <section className="bg-muted/4 rounded-2xl p-4 space-y-4" aria-label="محصول انتخاب‌شده">
      <div className="flex gap-3 items-center"><img src={product.images[0] || '/assets/images/placeholder.svg'} alt="" className="size-16 rounded-2xl object-cover bg-muted/10" /><div className="min-w-0"><h2 className="text-sm font-bold text-foreground break-words">{product.name}</h2><p className="text-xs text-muted mt-2"><bdi dir="ltr">{product.sku}</bdi>{product.brand && ` · ${product.brand}`}</p></div></div>
      {!reviewing && <><div className="space-y-2"><label htmlFor="supply-quantity" className="text-xs font-bold">مقدار درخواستی ({unit})</label><input id="supply-quantity" type="number" inputMode="decimal" min="0.01" max="1000000" step={product.productType === 'other' ? '1' : '0.01'} disabled={draft.pending || checking} value={draft.requestedQuantity || ''} onChange={event => supplyDraftStore.update({ requestedQuantity: Number(event.target.value) })} className="w-full h-12 px-3 rounded-2xl bg-muted/5 text-sm font-bold outline-primary" /></div><div className="space-y-2"><label htmlFor="supply-notes" className="text-xs font-bold">یادداشت (اختیاری)</label><textarea id="supply-notes" disabled={draft.pending || checking} maxLength={2000} value={draft.notes} onChange={event => supplyDraftStore.update({ notes: event.target.value })} rows={3} className="w-full p-3 rounded-2xl bg-muted/5 text-sm outline-primary" /></div></>}
      {reviewing && (quantityAdjusted || draft.notes) && <dl className="space-y-3 text-xs">
        {quantityAdjusted && quote && <div className="flex flex-wrap justify-between gap-2"><dt className="text-muted">مقدار اولیهٔ شما</dt><dd>{toPersianDigits(quote.requestedQuantity)} {unit}</dd></div>}
        {draft.notes && <div className="space-y-2"><dt className="text-muted">یادداشت</dt><dd className="whitespace-pre-wrap break-words">{draft.notes}</dd></div>}
      </dl>}
    </section>
    <p className="text-xs text-muted leading-6">این درخواست خرید یا رزرو قطعی نیست؛ نتیجه تا ۴۸ ساعت اعلام می‌شود.</p>
    {(preview.error || checkError) && !reviewing && <p role="alert" className="text-sm text-danger">دریافت برآورد ممکن نشد؛ دوباره تلاش کنید. <Button size="sm" variant="ghost" onPress={() => { setCheckError(false); void preview.refetch() }}>تلاش دوباره</Button></p>}
    {(current?.reason === 'exact_stock_available' || exactAvailable) && !reviewing && <p className="text-sm">موجودی قطعی برای این مقدار کافی است. <Button size="sm" variant="ghost" onPress={purchase}>خرید از موجودی</Button></p>}
    {current?.reason === 'no_active_source' && !reviewing && <p role="alert" className="text-sm text-danger">امکان درخواست تأمین برای این محصول فعال نیست.</p>}
    {mutation.error && !exactAvailable && <p role="alert" className="text-sm text-danger">ثبت درخواست تأیید نشد. اگر ارتباط قطع شده، با همین فرم دوباره تلاش کنید تا ثبت تکراری نشود.</p>}
    {!persisted && <p role="alert" className="text-sm text-danger">ذخیره پیش‌نویس ممکن نیست؛ برای جلوگیری از ثبت تکراری ابتدا فضای ذخیره‌سازی را فعال کنید. <Button size="sm" variant="ghost" onPress={supplyDraftStore.retryPersist}>تلاش دوباره</Button></p>}
    {draft.pending && <p role="status" className="text-sm text-muted">ممکن است درخواست قبلی ثبت شده باشد؛ نتیجه را با همان اطلاعات پیگیری کنید.</p>}
    </div>
    <CheckoutActionFooter fixed={presentation === 'page'}>
      {quote && <dl aria-label="خلاصهٔ برآورد درخواست" className="mx-auto w-full max-w-xl space-y-2.5 px-4 py-3 text-xs">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="shrink-0 font-medium text-muted">مقدار نهایی</dt>
          <dd className="text-end font-bold text-foreground"><bdi>{toPersianDigits(quote.roundedQuantity)} {formatUnit(quote.unit)}</bdi></dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="shrink-0 font-medium text-muted">بسته‌بندی</dt>
          <dd className="text-end font-bold text-foreground"><bdi>{quote.productType === 'tile' ? formatCartons(quote.packageCount, quote.cartonsPerPallet) : `${toPersianDigits(quote.packageCount)} ${formatUnit(quote.unit)}`}</bdi></dd>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border/10">
          <dt className="shrink-0 text-sm font-bold text-foreground">مبلغ برآوردی</dt>
          <dd className="inline-flex min-w-0 items-center gap-1 text-base font-extrabold text-foreground"><bdi>{formatToman(quote.estimatedTotal)}</bdi><TomanIcon className="size-4 shrink-0" /></dd>
        </div>
      </dl>}
      {!quote && <p role="status" className="mx-auto w-full max-w-xl px-4 py-2.5 text-xs text-muted">{!valid ? 'مقدار معتبر وارد کنید.' : preview.error || checkError ? 'برآورد در دسترس نیست.' : 'در حال محاسبهٔ برآورد…'}</p>}
      <div className="mx-auto flex w-full max-w-xl items-center gap-2.5 px-4 pt-1">
        {reviewing && <Button type="button" variant="secondary" isDisabled={submissionDisabled || draft.pending} onPress={() => setReview(null)} className="h-12 shrink-0 gap-1.5 rounded-2xl px-4 text-xs font-bold sm:text-sm"><PencilIcon size={16} /><span>ویرایش</span></Button>}
        <div className="min-w-0 flex-1">
          {reviewing || draft.pending ? <CheckoutCommit
            key={`${owner}:${draft.submissionKey}`}
            label={draft.pending ? 'برای پیگیری ثبت قبلی بکشید' : 'برای ثبت درخواست تأمین بکشید'}
            doneLabel="درخواست تأمین ثبت شد"
            errorLabel="ثبت درخواست تأمین انجام نشد"
            disabled={submissionDisabled}
            onConfirm={submit}
          /> : <Button
            type="button"
            fullWidth
            isPending={checking}
            isDisabled={submissionDisabled || !canContinue}
            onPress={() => void confirm()}
            className="h-12 gap-2 rounded-2xl px-4 text-sm font-bold active:scale-98 touch-manipulation"
          >
            <span>{checking ? 'در حال بررسی…' : 'بررسی درخواست'}</span>
            <ArrowLeftIcon size={16} />
          </Button>}
        </div>
      </div>
    </CheckoutActionFooter>
  </div>
}
