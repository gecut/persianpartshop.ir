import type { Product } from "@/modules/products/product-types"
import { formatGrade } from "@/modules/products/product-store"

interface ProductTagListProps {
  product: Product;
}

export function ProductTagList({ product: activeProduct }: ProductTagListProps) {
  return (
    <div className="pt-2 flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted font-base">
        ویژگی‌ها و برچسب‌ها:
      </span>
      {activeProduct.grade && (
        <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-primary/10 text-primary">
          {formatGrade(activeProduct.grade)}
        </span>
      )}
      {activeProduct.approxCoverage && (
        <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-primary/15 text-primary">
          پوشش: {activeProduct.approxCoverage}
        </span>
      )}
      {activeProduct.tags?.map((tag) => (
        <span
          key={tag}
          className="px-2 py-1 rounded-lg text-xs font-semibold bg-muted/10 text-foreground"
        >
          #{tag}
        </span>
      ))}
    </div>
  );
}
