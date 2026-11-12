import { Button } from "@heroui/react"
import { PRODUCT_GRADE_OPTIONS } from "@persianpart/contract"
import { StarIcon } from "@solar-icons/react/bold"
import type { useProducts } from "@/modules/products/product-store"

type ProductsHook = ReturnType<typeof useProducts>;

interface GradeFilterProps {
  filters: ProductsHook["filters"];
  toggleArrayFilter: ProductsHook["toggleArrayFilter"];
}

export function GradeFilter({ filters, toggleArrayFilter }: GradeFilterProps) {
  return (
    <div className="space-y-1.5 pt-0.5">
      <div className="flex items-center gap-1.5">
        <StarIcon aria-hidden="true" size={16} className="text-primary" />
        <label className="text-xs font-bold text-foreground block">
          درجه کیفی
        </label>
      </div>

      <div
        role="group"
        aria-label="درجه کیفی"
        className="grid w-full grid-cols-4 gap-1 rounded-2xl bg-muted/10 p-1"
      >
        {PRODUCT_GRADE_OPTIONS.map(({ value, label }) => {
          const isSelected = filters.selectedGrades.includes(label);

          return (
            <Button
              key={value}
              type="button"
              variant={isSelected ? "primary" : "ghost"}
              aria-pressed={isSelected}
              onPress={() => toggleArrayFilter("selectedGrades", label)}
              className="h-12 min-w-0 gap-1 rounded-xl px-1 text-xs font-bold aria-pressed:font-black"
            >
              <StarIcon
                aria-hidden="true"
                size={13}
                className={
                  isSelected
                    ? "text-primary-foreground"
                    : "text-primary/80"
                }
              />
              <bdi>{label}</bdi>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
