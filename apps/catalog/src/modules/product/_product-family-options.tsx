import type {
  PublicCatalogFamilyOption,
  PublicCatalogPage,
} from '@persianpart/contract/public-catalog'
import { ProductCard } from '@/components/product-card'

interface ProductFamilyOptionsProps {
  options: PublicCatalogFamilyOption[]
  currentId: string
  config: PublicCatalogPage['config']
}

export function ProductFamilyOptions({
  options,
  currentId,
  config,
}: ProductFamilyOptionsProps) {
  const otherOptions = options.filter((option) => option.id !== currentId)
  if (otherOptions.length === 0) return null

  return (
    <section className="pt-6 space-y-3" aria-labelledby="family-options-title">
      <h3 id="family-options-title" className="text-xs font-bold text-muted">
        گزینه‌های دیگر این محصول
      </h3>
      <div className="space-y-2">
        {otherOptions.map((option) => (
          <ProductCard
            key={option.id}
            product={option}
            config={config}
            priority={false}
          />
        ))}
      </div>
    </section>
  )
}
