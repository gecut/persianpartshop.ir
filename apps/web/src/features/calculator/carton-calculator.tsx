import { useState, useId } from 'react'
import { Button, InputGroup } from '@heroui/react'
import type { Product } from '../../types'
import { calculateCartonRequirement } from '../../lib/utils/math'
import { formatToman, toPersianDigits } from '../../lib/utils/currency'
import { useCart } from '../cart/cart-store'
import { toast } from '../../components/feedback/toast'
import { ShoppingCartIcon, BoxIcon, AlertTriangleIcon, CheckCircle2Icon, TomanIcon } from '../../components/ui/icons'

export interface CartonCalculatorProps {
  product: Product
  onAddedToCart?: () => void
}

export function CartonCalculator({ product, onAddedToCart }: CartonCalculatorProps) {
  const { addItem } = useCart()
  const inputId = useId()
  const [requestedArea, setRequestedArea] = useState<number>(35)
  const [isAdding, setIsAdding] = useState(false)

  const calc = calculateCartonRequirement(
    requestedArea,
    product.areaPerCarton,
    product.pricePerM2
  )

  const isExceedingStock = product.stockCartons > 0 && calc.cartonCount > product.stockCartons
  const isOutOfStock = !product.inStock || product.stockCartons === 0

  const handleAreaChange = (val: string) => {
    const parsed = parseFloat(val)
    if (isNaN(parsed) || parsed < 0) {
      setRequestedArea(0)
    } else {
      setRequestedArea(parsed)
    }
  }


  const handleAddToCart = () => {
    if (isOutOfStock || isExceedingStock || calc.cartonCount <= 0) return

    setIsAdding(true)
    setTimeout(() => {
      addItem(product, requestedArea)
      setIsAdding(false)
      toast.success(
        'به سبد خرید اضافه شد',
        `${toPersianDigits(calc.cartonCount)} کارتن (${toPersianDigits(calc.deliverableArea)}) از «${product.name}» به سبد خرید افزوده شد.`
      )
      if (onAddedToCart) onAddedToCart()
    }, 400)
  }

  return (
    <div className="bg-muted/5 rounded-2xl p-3.5 space-y-3.5">
      {/* Title */}
      <div className="flex items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
            <BoxIcon size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              محاسبه‌گر متراژ و کارتن تحویلی
            </h3>
            <span className="text-xs text-muted font-medium">
              فروش صرفاً بر اساس کارتن کامل کارخانه
            </span>
          </div>
        </div>
        <div className="text-end">
          <span className="text-xs text-muted font-medium block">هر کارتن:</span>
          <span className="text-sm font-bold text-foreground">
            {toPersianDigits(product.areaPerCarton)}
          </span>
        </div>
      </div>

      {/* Input Stage: Area required (Meter-based only) */}
      <div>
        <label htmlFor={inputId} className="block text-xs font-bold text-foreground mb-1.5 text-start">
          متراژ مورد نیاز (بر اساس متر مربع):
        </label>
        <InputGroup fullWidth className="h-11 rounded-2xl bg-muted/10 border border-border/40 transition-all">
          <InputGroup.Input
            id={inputId}
            type="number"
            step="0.1"
            min="0.1"
            value={requestedArea || ''}
            onChange={(e) => handleAreaChange(e.target.value)}
            placeholder="مثال: ۳۵"
            className="h-11 flex-1 px-3.5 text-foreground font-bold text-base text-start outline-hidden bg-transparent border-0 shadow-none ring-0"
          />
          <InputGroup.Suffix className="pe-3.5 text-xs font-bold text-muted pointer-events-none">
            متر مربع
          </InputGroup.Suffix>
        </InputGroup>

        {/* Quick Presets for Mobile */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <span className="text-xs text-muted font-medium">افزودن سریع:</span>
          {[5, 10, 25, 50, 100].map((preset) => (
            <Button
              key={preset}
              type="button"
              onPress={() => setRequestedArea((prev) => Math.round((prev + preset) * 10) / 10)}
              className="h-7 px-2.5 py-1 rounded-lg bg-muted/10 text-xs font-semibold text-foreground transition-all cursor-pointer active:scale-95"
            >
              +{toPersianDigits(preset)} متر
            </Button>
          ))}
        </div>
      </div>

      {/* Round-Up Notice Banner */}
      {!calc.isExactMultiple && calc.requestedArea > 0 && (
        <div className="p-3.5 rounded-2xl bg-warning/15 text-foreground text-xs space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-warning">
            <AlertTriangleIcon size={16} className="text-warning shrink-0" />
            <span>هشدار رُند شدن به بالا (بسته‌بندی کارخانه‌ای)</span>
          </div>
          <p className="text-xs leading-relaxed text-foreground">
            متراژ انتخابی شما ({toPersianDigits(calc.requestedArea)} متر) مضرب کامل کارتن نیست. سفارش شما{' '}
            <strong className="text-foreground font-black underline decoration-warning/50">
              به اندازه {toPersianDigits(calc.extraArea)} متر مربع به بالا رُند شد
            </strong>{' '}
            و معادل <strong>{toPersianDigits(calc.deliverableArea)} متر مربع</strong> ({toPersianDigits(calc.cartonCount)} کارتن پلمپ) به مبلغ کل{' '}
            <span className="inline-flex items-center gap-0.5 font-bold">
              <span>{formatToman(calc.totalPrice)}</span>
              <TomanIcon className="size-3" />
            </span>{' '}
            محاسبه خواهد شد.
          </p>
        </div>
      )}

      {/* Result Cards Breakdown (Slides metric style) */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <div className="bg-muted/10 p-2.5 rounded-2xl">
          <span className="text-xs text-muted font-medium block leading-tight mb-0.5">تعداد کارتن</span>
          <span className="text-sm font-bold text-primary">
            {toPersianDigits(calc.cartonCount)} کارتن
          </span>
        </div>

        <div className="bg-muted/10 p-2.5 rounded-2xl">
          <span className="text-xs text-muted font-medium block leading-tight mb-0.5">متراژ تحویلی</span>
          <span className="text-sm font-bold text-foreground">
            {toPersianDigits(calc.deliverableArea)}
          </span>
        </div>

        <div className="bg-muted/10 p-2.5 rounded-2xl">
          <span className="text-xs text-muted font-medium block leading-tight mb-0.5">مازاد پرت کارتن</span>
          <span className="text-sm font-bold text-foreground">
            {toPersianDigits(calc.extraArea)}
          </span>
        </div>

        <div className="bg-muted/10 p-2.5 rounded-2xl">
          <span className="text-xs text-muted font-medium block leading-tight mb-0.5">مبلغ کل برآورد</span>
          <span className="text-sm font-bold text-success truncate inline-flex items-center gap-1">
            <span>{formatToman(calc.totalPrice)}</span>
            <TomanIcon className="size-3.5" />
          </span>
        </div>
      </div>

      {/* Stock warning if applicable */}
      {isOutOfStock ? (
        <div className="p-2.5 rounded-2xl bg-danger/15 text-danger text-xs flex items-center gap-2">
          <AlertTriangleIcon size={16} className="shrink-0 text-danger" />
          <span className="font-semibold">این محصول در حال حاضر در انبار ناموجود است.</span>
        </div>
      ) : isExceedingStock ? (
        <div className="p-2.5 rounded-2xl bg-warning/15 text-warning text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <AlertTriangleIcon size={16} className="shrink-0 text-warning" />
            <span>
              موجودی: <strong>{toPersianDigits(product.stockCartons)}</strong> کارتن
            </span>
          </div>
          <Button
            type="button"
            onPress={() => setRequestedArea(Math.round(product.stockCartons * product.areaPerCarton * 100) / 100)}
            className="text-xs font-bold text-warning underline cursor-pointer bg-transparent h-auto p-0 min-w-0"
          >
            تنظیم به سقف انبار
          </Button>
        </div>
      ) : (
        <div className="p-2.5 rounded-2xl bg-success/15 text-success text-xs flex items-center gap-1.5">
          <CheckCircle2Icon size={15} className="text-success shrink-0" />
          <span>
            سهمیه موجود است ({toPersianDigits(product.stockCartons)} کارتن در انبار آماده تحویل).
          </span>
        </div>
      )}

      {/* Primary CTA */}
      <Button
        type="button"
        onPress={handleAddToCart}
        isDisabled={isOutOfStock || isExceedingStock || calc.cartonCount <= 0 || isAdding}
        className="w-full h-12 rounded-2xl bg-primary hover:bg-primary/90 active:scale-98 text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ShoppingCartIcon size={18} />
        <span>افزودن به سبد خرید ({toPersianDigits(calc.cartonCount)} کارتن)</span>
      </Button>
    </div>
  )
}
