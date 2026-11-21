import type {
  PublicCatalogFamilyOption,
  PublicCatalogProduct,
} from '@persianpart/contract/public-catalog'
import { cn } from '@heroui/react'
import { formatSquareMeters, formatUnit, toPersianDigits } from '@/lib/format'

type ProductValuesProps = {
  product: PublicCatalogProduct | PublicCatalogFamilyOption
  variant?: 'badge' | 'detail'
}
export function ProductValues({
  product,
  variant = 'detail',
}: ProductValuesProps) {
  const stock = product.stock
  if (stock.mode === 'hidden') return null
  const available = stock.status === 'available'
  const inquiry = stock.status === 'inquiry'
  const label = inquiry ? 'قابل استعلام' : available ? 'موجود' : 'ناموجود'
  if (variant === 'detail')
    return (
      <span
        className={cn(
          'flex items-center justify-end font-bold text-xs leading-normal truncate',
          available ? 'text-success' : inquiry ? 'text-primary' : 'text-danger',
        )}
      >
        {stock.mode === 'numeric' ? (
          <bdi>
            {formatSquareMeters(stock.quantity)}
            {stock.capped ? '+' : ''}{' '}
            {product.productType === 'other' ? formatUnit(product.unit) : 'متر'}
          </bdi>
        ) : (
          label
        )}
      </span>
    )
  return (
    <div className="mt-auto">
      <span
        className={cn(
          'px-2 py-1 rounded-lg flex text-xs font-semibold',
          inquiry
            ? 'bg-primary/10 text-primary'
            : !available
              ? 'bg-danger/15 text-danger'
              : stock.mode === 'status'
                ? 'bg-success/20 text-success'
                : 'bg-foreground text-background',
        )}
      >
        {stock.mode === 'numeric' && available ? (
          <span className="flex items-center gap-0.5">
            موجودی: {toPersianDigits(Math.floor(stock.quantity))}
            {stock.capped ? '+' : ''}{' '}
            {product.productType === 'other' ? formatUnit(product.unit) : 'متر'}
          </span>
        ) : (
          label
        )}
      </span>
    </div>
  )
}
