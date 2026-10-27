import { useState, useId } from 'react'
import { Modal as HeroUIModal, Button, InputGroup } from '@heroui/react'
import type { Product } from '../../types'
import { calculateCartonRequirement } from '../../lib/utils/math'
import { formatToman, toPersianDigits } from '../../lib/utils/currency'
import { useCart } from '../cart/cart-store'
import { toast } from '../../components/feedback/toast'
import {
  XIcon,
  ShoppingCartIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  BoxIcon,
  TomanIcon,
} from '../../components/ui/icons'

export interface OrderEntryModalProps {
  product: Product | null
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function OrderEntryModal({
  product,
  isOpen,
  onClose,
  onSuccess,
}: OrderEntryModalProps) {
  const inputId = useId()
  const { addItem } = useCart()
  const [requestedArea, setRequestedArea] = useState<number>(35)
  const [isAdding, setIsAdding] = useState(false)

  if (!isOpen || !product) return null

  const calc = calculateCartonRequirement(
    requestedArea,
    product.sqmPerCarton,
    product.finalCustomerPricePerSqm,
    product.inventorySqm
  )

  const isOutOfStock = product.stockStatus === 'out_of_stock' || product.inventorySqm <= 0

  const handleAreaChange = (val: string) => {
    const parsed = parseFloat(val)
    if (isNaN(parsed) || parsed < 0) {
      setRequestedArea(0)
    } else {
      setRequestedArea(parsed)
    }
  }

  const handleAddToCart = () => {
    if (isOutOfStock || calc.isExceedingStock || calc.cartonCount <= 0) return

    setIsAdding(true)
    setTimeout(() => {
      addItem(product, requestedArea)
      setIsAdding(false)
      toast.success(
        'به سبد خرید افزوده شد',
        `${toPersianDigits(calc.cartonCount)} کارتن (${toPersianDigits(calc.deliverableArea)}) از «${product.name}» افزوده شد.`
      )
      onClose()
      if (onSuccess) onSuccess()
    }, 300)
  }

  return (
    <HeroUIModal.Root isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <HeroUIModal.Backdrop
        isDismissable
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 m-0! mb-0! sm:p-4 animate-backdrop-enter"
      >
        <HeroUIModal.Container className="pointer-events-none w-full max-w-xl h-auto p-0 m-0! mb-0! flex flex-col items-center justify-end sm:justify-center">
          <HeroUIModal.Dialog className="pointer-events-auto relative w-full bg-surface rounded-t-2xl rounded-b-none! sm:rounded-2xl flex flex-col max-h-[92dvh] m-0! mb-0! bottom-0! z-10 overflow-hidden animate-drawer-slide-up sm:animate-modal-enter text-start border-b-0!">
            {/* Handle for mobile */}
            <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-muted/40" />
            </div>

            {/* Header */}
            <HeroUIModal.Header className="px-4 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="size-9 rounded-2xl bg-primary/15 text-primary flex items-center justify-center font-bold">
                  <BoxIcon size={18} />
                </div>
                <div>
                  <HeroUIModal.Heading className="text-sm font-bold text-foreground">
                    تعیین متراژ و محاسبه کارتن
                  </HeroUIModal.Heading>
                  <span className="text-xs text-muted font-medium">
                    فروش صرفاً بر مبنای کارتن کامل کارخانه
                  </span>
                </div>
              </div>

              <HeroUIModal.CloseTrigger
                onClick={onClose}
                className="size-9 rounded-2xl text-muted hover:text-foreground bg-muted/10 hover:bg-muted/20 flex items-center justify-center transition-colors cursor-pointer"
                aria-label="بستن پنجره سفارش"
              >
                <XIcon size={18} />
              </HeroUIModal.CloseTrigger>
            </HeroUIModal.Header>

            {/* Content Body */}
            <HeroUIModal.Body className="p-4 overflow-y-auto space-y-4 text-start pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">
              {/* Selected Product Summary Card */}
              <div className="flex items-center gap-3 p-2.5 bg-muted/5 rounded-2xl">
                <img
                  src={product.images[0] || '/assets/images/placeholder.svg'}
                  alt={product.name}
                  className="size-14 rounded-2xl object-cover shrink-0"
                  onError={(e) => {
                    if (!e.currentTarget.src.endsWith('/assets/images/placeholder.svg')) {
                      e.currentTarget.src = '/assets/images/placeholder.svg'
                    }
                  }}
                />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-primary block">
                    {product.brand} · {product.dimension}
                  </span>
                  <h3 className="text-sm font-bold text-foreground truncate mt-0.5">
                    {product.name}
                  </h3>
                  <div className="text-xs text-muted mt-0.5">
                    موجودی انبار: <strong>{toPersianDigits(product.inventorySqm)}</strong> ({toPersianDigits(product.stockCartons)} کارتن)
                  </div>
                </div>
                <div className="text-end shrink-0">
                  <span className="text-sm font-bold text-primary inline-flex items-center gap-1 justify-end">
                    <span>{formatToman(product.finalCustomerPricePerSqm)}</span>
                    <TomanIcon className="size-3.5" />
                  </span>
                  <span className="text-xs text-muted block">هر متر مربع</span>
                </div>
              </div>

              {/* Customer Input: requestedSqm ONLY */}
              <div>
                <label htmlFor={inputId} className="block text-xs font-bold text-foreground mb-1.5">
                  متراژ درخواستی (بر اساس متر مربع):
                </label>
                <InputGroup fullWidth className="h-12 rounded-2xl bg-muted/5 focus-within:bg-muted/10 transition-all border border-border/40">
                  <InputGroup.Input
                    id={inputId}
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={requestedArea || ''}
                    onChange={(e) => handleAreaChange(e.target.value)}
                    placeholder="مثال: ۳۵"
                    className="h-12 flex-1 px-3.5 text-foreground font-bold text-lg text-start outline-hidden bg-transparent border-0 shadow-none ring-0"
                  />
                  <InputGroup.Suffix className="pe-3.5 text-xs font-bold text-muted pointer-events-none">
                    متر مربع
                  </InputGroup.Suffix>
                </InputGroup>

                {/* Quick Add Presets in Meters only */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-xs text-muted font-medium">افزودن سریع:</span>
                  {[5, 10, 25, 50, 100].map((preset) => (
                    <Button
                      key={preset}
                      type="button"
                      onClick={() => setRequestedArea((prev) => Math.round((prev + preset) * 10) / 10)}
                      className="h-8 px-2.5 rounded-lg bg-muted/10 hover:bg-muted/20 text-xs font-semibold text-foreground transition-all cursor-pointer active:scale-95"
                    >
                      +{toPersianDigits(preset)} متر
                    </Button>
                  ))}
                </div>
              </div>

              {/* Round-Up Warning Alert */}
              {!calc.isExactMultiple && calc.requestedArea > 0 && (
                <div className="p-3.5 rounded-2xl bg-warning/15 text-warning-foreground text-xs space-y-1.5 animate-in fade-in">
                  <div className="flex items-center gap-2 font-bold text-foreground">
                    <AlertTriangleIcon size={16} className="text-warning shrink-0" />
                    <span>هشدار رُند شدن به بالا (بسته‌بندی کارخانه‌ای)</span>
                  </div>
                  <p className="text-xs leading-relaxed text-foreground">
                    متراژ انتخابی شما ({toPersianDigits(calc.requestedArea)} متر) مضرب کاملی از بسته‌بندی کارخانه نیست.
                    جهت حفظ سلامت قطعات و بسته‌بندی کارخانه‌ای، مقدار به اندازه{' '}
                    <strong className="text-foreground font-black underline decoration-warning">
                      {toPersianDigits(calc.extraArea)} متر مربع به بالا رُند شد
                    </strong>{' '}
                    و مجموعاً <strong>{toPersianDigits(calc.deliverableArea)} متر مربع</strong> ({toPersianDigits(calc.cartonCount)} کارتن پلمپ) به مبلغ کل{' '}
                    <span className="inline-flex items-center gap-0.5 font-bold">
                      <span>{formatToman(calc.totalPrice)}</span>
                      <TomanIcon className="size-3" />
                    </span>{' '}
                    محاسبه خواهد شد.
                  </p>
                </div>
              )}

              {/* Carton Calculation Live Preview */}
              <div className="bg-muted/5 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between pb-2 text-xs">
                  <span className="font-bold text-foreground">پیش‌نمایش محاسبه هوشمند کارتن</span>
                  <span className="text-xs font-medium text-muted">
                    هر کارتن = {toPersianDigits(product.sqmPerCarton)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-muted/10 p-2.5 rounded-2xl">
                    <span className="text-xs text-muted block mb-0.5">مقدار درخواستی</span>
                    <span className="font-bold text-foreground">
                      {toPersianDigits(calc.requestedArea)}
                    </span>
                  </div>

                  <div className="bg-muted/10 p-2.5 rounded-2xl">
                    <span className="text-xs text-muted block mb-0.5">تعداد کارتن</span>
                    <span className="font-bold text-primary">
                      {toPersianDigits(calc.cartonCount)} کارتن
                    </span>
                  </div>

                  <div className="bg-muted/10 p-2.5 rounded-2xl">
                    <span className="text-xs text-muted block mb-0.5">مقدار واقعی تحویلی</span>
                    <span className="font-bold text-foreground">
                      {toPersianDigits(calc.deliverableArea)}
                    </span>
                  </div>

                  <div className="bg-muted/10 p-2.5 rounded-2xl">
                    <span className="text-xs text-muted block mb-0.5">مازاد بر درخواست</span>
                    <span className="font-bold text-muted">
                      +{toPersianDigits(calc.extraArea)}
                    </span>
                  </div>
                </div>

                {/* Price Preview */}
                <div className="pt-2 flex items-baseline justify-between">
                  <div>
                    <span className="text-xs text-muted block">مبلغ کل ردیف (بر اساس متراژ تحویلی):</span>
                    <span className="text-xs text-muted inline-flex items-center gap-1">
                      <span>{toPersianDigits(calc.deliverableArea)} × {formatToman(product.finalCustomerPricePerSqm)}</span>
                      <TomanIcon className="size-3" />
                    </span>
                  </div>
                  <span className="text-base font-bold text-success inline-flex items-center gap-1">
                    <span>{formatToman(calc.totalPrice)}</span>
                    <TomanIcon className="size-4" />
                  </span>
                </div>
              </div>

              {/* Inventory Validation & Alerts */}
              {isOutOfStock ? (
                <div className="p-3 rounded-2xl bg-danger/15 text-danger text-xs flex items-center gap-2">
                  <AlertTriangleIcon size={16} className="text-danger shrink-0" />
                  <span className="font-bold">این کالا در حال حاضر در انبار ناموجود است.</span>
                </div>
              ) : calc.isExceedingStock ? (
                <div className="p-3 rounded-2xl bg-danger/15 text-danger text-xs space-y-1.5">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertTriangleIcon size={16} className="text-danger shrink-0" />
                    <span>موجودی کافی نیست!</span>
                  </div>
                  <p className="text-xs text-danger leading-relaxed">
                    {calc.errorMessage}
                  </p>
                  <Button
                    type="button"
                    onClick={() => setRequestedArea(calc.maxDeliverableSqm)}
                    className="text-xs font-bold text-danger underline cursor-pointer"
                  >
                    تنظیم سفارش بر روی حداکثر موجودی ({toPersianDigits(calc.maxDeliverableSqm)})
                  </Button>
                </div>
              ) : (
                <div className="p-2.5 rounded-2xl bg-success/15 text-success text-xs flex items-center gap-2">
                  <CheckCircle2Icon size={16} className="text-success shrink-0" />
                  <span className="font-medium">
                    سهمیه تحویل فوری موجود است ({toPersianDigits(product.stockCartons)} کارتن در انبار).
                  </span>
                </div>
              )}

              {/* Action CTA */}
              <div className="pt-2">
                <Button
                  type="button"
                  onPress={handleAddToCart}
                  isDisabled={isOutOfStock || calc.isExceedingStock || calc.cartonCount <= 0 || isAdding}
                  className="w-full h-12 rounded-2xl bg-primary hover:bg-primary/90 active:scale-98 text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ShoppingCartIcon size={18} />
                  <span>
                    افزودن به سبد خرید ({toPersianDigits(calc.cartonCount)} کارتن ({toPersianDigits(calc.deliverableArea)}))
                  </span>
                </Button>
              </div>
            </HeroUIModal.Body>
          </HeroUIModal.Dialog>
        </HeroUIModal.Container>
      </HeroUIModal.Backdrop>
    </HeroUIModal.Root>
  )
}
