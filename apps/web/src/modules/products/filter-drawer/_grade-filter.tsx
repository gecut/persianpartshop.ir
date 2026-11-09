import { Button } from "@heroui/react"
import { StarIcon } from "@solar-icons/react/bold"
import { useProducts } from "@/modules/products/product-store"
import { cn } from "@/lib/utils"

type ProductsHook = ReturnType<typeof useProducts>;

const AVAILABLE_GRADES = ["درجه ۱", "درجه ۲", "درجه ۳", "درجه ۴"] as const;

interface GradeFilterProps {
  filters: ProductsHook["filters"];
  toggleArrayFilter: ProductsHook["toggleArrayFilter"];
}

export function GradeFilter({ filters, toggleArrayFilter }: GradeFilterProps) {
  return (
    <div className="space-y-1.5 pt-0.5">
      <div className="flex items-center gap-1.5">
        <StarIcon size={16} className="text-primary" />
        <label className="text-xs font-bold text-foreground block">
          درجه کیفی
        </label>
      </div>

      <div
        role="group"
        aria-label="درجه کیفی"
        className="w-full rounded-2xl bg-muted/10 flex items-center"
      >
        {AVAILABLE_GRADES.map((grade) => {
          const isSelected = filters.selectedGrades.includes(grade);

          return (
            <Button
              key={grade}
              type="button"
              onPress={() =>
                toggleArrayFilter("selectedGrades", grade)
              }
              className={cn(
                "flex-1 h-12 rounded-none! first:rounded-r-xl! last:rounded-l-xl! text-xs font-bold transition-all flex items-center justify-center cursor-pointer border-0 ring-0 outline-none",
                isSelected
                  ? "bg-primary text-primary-foreground font-black"
                  : "bg-transparent hover:bg-default/15 text-foreground",
              )}
            >
              <StarIcon
                size={13}
                className={
                  isSelected
                    ? "text-primary-foreground"
                    : "text-primary/80"
                }
              />
              <span>{grade}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
