import { useState, useEffect } from 'react'
import { Button, Input } from '@heroui/react'
import type { Plan, B2BCustomer, Product } from '../../types'
import { toPersianDigits, formatToman } from '../../lib/utils/currency'
import { Modal } from '../../components/ui/modal'
import { CheckIcon, TomanIcon } from '../../components/ui/icons'

export interface PlanModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (planData: Omit<Plan, 'id' | 'createdAt'> & { id?: string }) => void
  editingPlan?: Plan | null
  customers: B2BCustomer[]
  allProducts: Product[]
}

export function PlanModal({
  isOpen,
  onClose,
  onSave,
  editingPlan,
  customers,
  allProducts,
}: PlanModalProps) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [customerId, setCustomerId] = useState(customers[0]?.id || '')
  const [planType, setPlanType] = useState<'credit_terms' | 'product_discount' | 'informational'>('credit_terms')
  const [discountPercent, setDiscountPercent] = useState<number>(10)
  const [status, setStatus] = useState<'active' | 'expired' | 'draft' | 'completed' | 'successful'>('active')
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [hasTimer, setHasTimer] = useState(false)
  const [expiresAt, setExpiresAt] = useState('')

  useEffect(() => {
    if (editingPlan) {
      setTitle(editingPlan.title)
      setContent(editingPlan.content || editingPlan.notes || '')
      setCustomerId(editingPlan.customerId)
      setPlanType(editingPlan.type || 'credit_terms')
      setDiscountPercent(editingPlan.discountPercent ?? 10)
      setStatus(editingPlan.status || (editingPlan.isActive ? 'active' : 'expired'))
      setSelectedProductIds(editingPlan.productIds)
      setNotes(editingPlan.notes || '')
      setHasTimer(Boolean(editingPlan.hasTimer))
      setExpiresAt(editingPlan.expiresAt || '')
    } else {
      setTitle('')
      setContent('')
      setCustomerId(customers[0]?.id || '')
      setPlanType('credit_terms')
      setDiscountPercent(10)
      setStatus('active')
      setSelectedProductIds(['prod-9', 'prod-1'])
      setNotes('')
      setHasTimer(false)
      setExpiresAt('')
    }
  }, [editingPlan, customers, isOpen])

  const toggleProduct = (productId: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    )
  }

  const selectedCustomer = customers.find((c) => c.id === customerId)
  const defaultDynamicTitle = selectedCustomer
    ? `${selectedCustomer.name} عزیز، این طرح برای شماست`
    : 'همکار عزیز، این طرح برای شماست'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || !customerId) return

    const cust = customers.find((c) => c.id === customerId)
    const finalTitle = title.trim() || defaultDynamicTitle

    onSave({
      id: editingPlan?.id,
      title: finalTitle,
      customerGreeting: defaultDynamicTitle,
      customerId,
      customerName: cust ? `${cust.name} (${cust.company})` : '',
      type: planType,
      discountPercent: planType === 'product_discount' ? Number(discountPercent) || 10 : undefined,
      isActive: status === 'active',
      status,
      content: content.trim(),
      productIds: selectedProductIds,
      notes: notes.trim(),
      hasTimer,
      expiresAt: hasTimer && expiresAt ? expiresAt : undefined,
    })
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingPlan ? 'ویرایش طرح' : 'ایجاد طرح جدید'}
      isBottomSheetOnMobile={true}
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-start">
        {/* Customer Selection: Customer [ Select Customer ▼ ] */}
        <div>
          <label className="block text-xs font-bold text-foreground mb-1">
            مشتری هدف: <span className="text-danger">*</span>
          </label>
          <div className="relative">
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full h-10 px-3 pe-8 rounded-2xl bg-muted/5 focus:bg-muted/10 text-xs font-bold text-foreground transition-all outline-hidden appearance-none cursor-pointer"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} - {c.company} ({c.phone})
                </option>
              ))}
            </select>
            <div className="absolute end-3 top-3 pointer-events-none text-muted text-xs font-bold">
              ▼
            </div>
          </div>
        </div>

        {/* Plan Title (Dynamic preview if empty) */}
        <div>
          <label className="block text-xs font-bold text-foreground mb-1">
            عنوان طرح (اختیاری):
          </label>
          <Input
            fullWidth
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={defaultDynamicTitle}
            className="w-full h-10 px-3 rounded-2xl bg-muted/5 focus:bg-muted/10 text-xs font-bold text-foreground transition-all outline-hidden"
          />
          <div className="text-xs text-primary mt-1 flex items-center gap-1 font-medium">
            <span>پیش‌نمایش عنوان:</span>
            <span className="font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-lg text-xs">
              {title || defaultDynamicTitle}
            </span>
          </div>
        </div>

        {/* Plan Type Selector (Credit Terms vs Product Discount vs Informational) */}
        <div>
          <label className="block text-xs font-bold text-foreground mb-1.5">
            نوع طرح تجاری: <span className="text-danger">*</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              onClick={() => setPlanType('credit_terms')}
              className={`p-2.5 rounded-2xl text-xs font-bold transition-all text-start flex flex-col gap-1 cursor-pointer ${
                planType === 'credit_terms'
                  ? 'bg-primary/10 text-primary ring-1 ring-primary'
                  : 'bg-muted/5 text-muted hover:bg-muted/10'
              }`}
            >
              <span className="font-bold text-xs">
                خرید اعتباری
              </span>
              <span className="text-[10px] font-normal text-muted leading-tight">
                مهلت مدت‌دار
              </span>
            </Button>

            <Button
              type="button"
              onClick={() => setPlanType('product_discount')}
              className={`p-2.5 rounded-2xl text-xs font-bold transition-all text-start flex flex-col gap-1 cursor-pointer ${
                planType === 'product_discount'
                  ? 'bg-success/15 text-success ring-1 ring-success'
                  : 'bg-muted/5 text-muted hover:bg-muted/10'
              }`}
            >
              <span className="font-bold text-xs">
                تخفیف کالا
              </span>
              <span className="text-[10px] font-normal text-muted leading-tight">
                درصد مازاد
              </span>
            </Button>

            <Button
              type="button"
              onClick={() => setPlanType('informational')}
              className={`p-2.5 rounded-2xl text-xs font-bold transition-all text-start flex flex-col gap-1 cursor-pointer ${
                planType === 'informational'
                  ? 'bg-amber-500/15 text-amber-600 ring-1 ring-amber-500'
                  : 'bg-muted/5 text-muted hover:bg-muted/10'
              }`}
            >
              <span className="font-bold text-xs">
                اطلاع‌رسانی
              </span>
              <span className="text-[10px] font-normal text-muted leading-tight">
                اعلامیه و زنگ
              </span>
            </Button>
          </div>
        </div>

        {/* If product_discount mode: Show Discount Percent setting */}
        {planType === 'product_discount' && (
          <div className="p-3 bg-success/10 rounded-2xl space-y-2 animate-fade-in">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-success">
                درصد تخفیف اعمالی روی کالاها:
              </label>
              <span className="text-xs font-black text-success bg-success/15 px-2 py-0.5 rounded-lg">
                {toPersianDigits(discountPercent)}٪ تخفیف
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={50}
                value={discountPercent}
                onChange={(e) => setDiscountPercent(Number(e.target.value))}
                className="flex-1 h-2 bg-success/20 rounded-lg appearance-none cursor-pointer accent-success"
              />
              <div className="flex items-center gap-1 shrink-0">
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(Number(e.target.value))}
                  className="w-16 h-8 text-center text-xs font-bold rounded-lg bg-surface focus:outline-primary"
                />
                <span className="text-xs font-bold text-success">٪</span>
              </div>
            </div>
            <p className="text-[11px] text-success leading-tight">
              این تخفیف در لیست محصولات و سبد خرید خریدار منتخب اعمال شده و قیمت‌های کالا با نشان تخفیف ویژه به روز می‌شوند.
            </p>
          </div>
        )}

        {/* Content (Textarea) */}
        <div>
          <label className="block text-xs font-bold text-foreground mb-1">
            متن پیام طرح (Textarea): <span className="text-danger">*</span>
          </label>
          <textarea
            required
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={
              planType === 'credit_terms'
                ? 'مثال: امکان خرید اعتباری با بازپرداخت ۳ ماهه و ارائه چک صیادی...'
                : 'مثال: به پاس همکاری‌های مستمر، ۱۰٪ تخفیف مازاد برای این اقلام به مدت محدود فعال شد...'
            }
            className="w-full p-2.5 rounded-2xl bg-muted/5 focus:bg-muted/10 text-xs text-foreground transition-all outline-hidden"
          />
          <span className="text-xs text-muted mt-0.5 block">
            متنی که برای کاربر در این طرح نمایش داده می‌شود.
          </span>
        </div>

        {/* Status: Active / Expired / Draft */}
        <div>
          <label className="block text-xs font-bold text-foreground mb-1.5">
            وضعیت طرح (Status): <span className="text-danger">*</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { val: 'active', label: 'در حال اجرا', color: 'bg-success/15 text-success ring-1 ring-success' },
              { val: 'expired', label: 'منقضی شده', color: 'bg-warning/15 text-warning ring-1 ring-warning' },
              { val: 'draft', label: 'پیش‌نویس', color: 'bg-muted/10 text-foreground ring-1 ring-muted' },
            ].map((st) => (
              <Button
                key={st.val}
                type="button"
                onClick={() => setStatus(st.val as any)}
                className={`py-2 px-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  status === st.val
                    ? `${st.color} font-bold`
                    : 'bg-muted/5 text-muted hover:bg-muted/10'
                }`}
              >
                {st.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Timer Configuration (Optional Boolean + Expiry Date) */}
        <div className="p-3 bg-muted/5 border border-border/40 rounded-2xl space-y-2.5">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hasTimer}
              onChange={(e) => setHasTimer(e.target.checked)}
              className="size-4 rounded accent-primary cursor-pointer"
            />
            <span className="text-xs font-bold text-foreground">
              فعال‌سازی تایمر شمارش معکوس
            </span>
          </label>
          <p className="text-[11px] text-muted leading-tight">
            در صورت فعال بودن، زمان معکوس باقی‌مانده بالای آیکون طرح نمایش داده می‌شود.
          </p>

          {hasTimer && (
            <div className="pt-1.5 space-y-1">
              <label className="block text-xs font-bold text-foreground">
                تاریخ و زمان انقضای طرح: <span className="text-danger">*</span>
              </label>
              <Input
                fullWidth
                type="datetime-local"
                value={expiresAt ? expiresAt.substring(0, 16) : ''}
                onChange={(e) =>
                  setExpiresAt(e.target.value ? new Date(e.target.value).toISOString() : '')
                }
                className="w-full h-10 px-3 rounded-2xl bg-muted/10 text-xs font-bold text-foreground transition-all outline-hidden"
              />
            </div>
          )}
        </div>

        {/* Products in Plan Selection (Independent Relation from Tags) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-foreground">
              انتخاب کالاهای شامل طرح (Select Products):
            </label>
            <span className="text-xs font-semibold text-primary">
              {toPersianDigits(selectedProductIds.length)} انتخاب شده
            </span>
          </div>
          <span className="text-xs text-muted block pb-1">
            این رابطه مستقلاً برای هر طرح تنظیم می‌شود و ارتباطی با تگ‌های عمومی محصول ندارد.
          </span>

          <div className="max-h-48 overflow-y-auto rounded-2xl divide-y divide-separator/50 p-1 bg-muted/5">
            {allProducts.map((product) => {
              const isChecked = selectedProductIds.includes(product.id)
              const originalPrice = product.finalCustomerPricePerSqm
              const discountedPrice =
                planType === 'product_discount'
                  ? Math.round(originalPrice * (1 - (discountPercent || 10) / 100))
                  : originalPrice

              return (
                <label
                  key={product.id}
                  className={`flex items-center gap-2.5 p-2 rounded-xl transition-colors cursor-pointer select-none ${
                    isChecked ? 'bg-primary/10' : 'hover:bg-muted/10'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleProduct(product.id)}
                    className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer shrink-0"
                  />
                  <img
                    src={product.images[0] || '/assets/images/placeholder.svg'}
                    alt={product.name}
                    className="w-8 h-8 rounded-xl object-cover shrink-0"
                    onError={(e) => {
                      if (!e.currentTarget.src.endsWith('/assets/images/placeholder.svg')) {
                        e.currentTarget.src = '/assets/images/placeholder.svg'
                      }
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold text-foreground truncate block">
                      {product.name}
                    </span>
                    <span className="text-xs text-muted">
                      {product.brand} · {toPersianDigits(product.dimension)}
                    </span>
                  </div>
                  <div className="text-end shrink-0">
                    {planType === 'product_discount' && isChecked ? (
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] text-muted line-through inline-flex items-center gap-0.5">
                          <span>{formatToman(originalPrice)}</span>
                          <TomanIcon className="size-2.5" />
                        </span>
                        <span className="text-xs font-bold text-success inline-flex items-center gap-0.5">
                          <span>{formatToman(discountedPrice)}</span>
                          <TomanIcon className="size-3" />
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-foreground inline-flex items-center gap-0.5">
                        <span>{formatToman(originalPrice)}</span>
                        <TomanIcon className="size-3" />
                      </span>
                    )}
                  </div>
                </label>
              )
            })}
          </div>
        </div>

        {/* Optional Notes */}
        <div>
          <label className="block text-xs font-bold text-foreground mb-1">
            یادداشت داخلی طرح (اختیاری):
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="توضیحات و شرایط ویژه طرح..."
            className="w-full p-2.5 rounded-2xl bg-muted/5 focus:bg-muted/10 text-xs text-foreground transition-all outline-hidden"
          />
        </div>

        {/* Action Buttons */}
        <div className="pt-2 grid grid-cols-2 gap-3">
          <Button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-2xl bg-muted/10 hover:bg-muted/15 text-foreground text-xs font-bold transition-colors cursor-pointer"
          >
            انصراف
          </Button>
          <Button
            type="submit"
            className="h-10 px-4 rounded-2xl bg-primary hover:bg-primary/90 active:scale-98 text-primary-foreground text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <CheckIcon size={16} />
            <span>{editingPlan ? 'ذخیره تغییرات' : 'ثبت طرح'}</span>
          </Button>
        </div>
      </form>
    </Modal>
  )
}
