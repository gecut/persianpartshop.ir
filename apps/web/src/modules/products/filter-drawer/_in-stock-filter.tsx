import { Switch } from "@heroui/react"
import { useProducts } from "@/modules/products/product-store"
import { cn } from "@/lib/utils"

type ProductsHook = ReturnType<typeof useProducts>;

interface InStockFilterProps {
  filters: ProductsHook["filters"];
  dispatchFilter: ProductsHook["dispatchFilter"];
}

export function InStockFilter({ filters, dispatchFilter }: InStockFilterProps) {
  return (
    <div
      className="py-4 px-4 rounded-2xl bg-muted/5 flex items-center justify-between cursor-pointer select-none"
      onClick={() => dispatchFilter({ type: "onlyInStock", onlyInStock: !filters.onlyInStock })}
    >
      <div>
        <span className="text-xs font-black text-foreground block">
          فقط کالاهای موجود
        </span>
        <span className="text-xs text-muted font-medium block mt-0.5">
          عدم نمایش کالاهای ناموجود در انبار
        </span>
      </div>

      <Switch
        isSelected={filters.onlyInStock}
        onChange={(isSelected) =>
          dispatchFilter({ type: "onlyInStock", onlyInStock: isSelected })
        }
        aria-label="فقط کالاهای موجود"
        className="group rounded-full"
      >
        <Switch.Content className="rounded-full">
          <Switch.Control
            className={cn(
              "rounded-full w-16! h-8! min-w-16! min-h-8! max-w-16! max-h-8! flex items-center transition-colors",
              filters.onlyInStock ? "bg-primary!" : "bg-muted/20!",
            )}
          >
            <Switch.Thumb
              className={cn(
                "rounded-full w-8! h-6.5! min-w-8! min-h-6.5! max-w-8! max-h-6.5! shrink-0! bg-white shadow-sm transition-[margin] duration-200 ease-out",
                filters.onlyInStock
                  ? "ms-[calc(100%-35px)]!"
                  : "ms-0.75!",
              )}
            />
          </Switch.Control>
        </Switch.Content>
      </Switch>
    </div>
  );
}
