import type { Product } from "@/modules/catalog/product-types"
import { ProductCard } from "@/modules/products/product-card"

interface ProductFamilyOptionsProps {
  options: Product[]
  activeId: string
  onViewProduct: (product: Product) => void
}

export function ProductFamilyOptions({ options, activeId, onViewProduct }: ProductFamilyOptionsProps) {
  const otherOptions = options.filter(option => String(option.id) !== String(activeId))
  if (otherOptions.length === 0) return null

  return (
    <section className="pt-6 space-y-3" aria-labelledby="product-family-heading">
      <h3 id="product-family-heading" className="text-xs font-bold text-muted">
        گزینه‌های دیگر این محصول
      </h3>
      <div className="space-y-2">
        {otherOptions.map(option => (
          <ProductCard
            key={option.id}
            product={option}
            isCompact
            isSelected={false}
            onToggleSelect={onViewProduct}
            onViewProduct={onViewProduct}
          />
        ))}
      </div>
    </section>
  )
}
