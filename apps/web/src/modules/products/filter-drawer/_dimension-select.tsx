import { Dropdown, Button, Label } from "@heroui/react"
import { useProducts } from "@/modules/products/product-store"
import { ChevronDownIcon } from "@/components/ui/icons"
import { toPersianDigits } from "@/lib/utils/currency"
import { cn } from "@/lib/utils"

type ProductsHook = ReturnType<typeof useProducts>;

interface DimensionSelectProps {
  filters: ProductsHook["filters"];
  setFilter: ProductsHook["setFilter"];
  dimensions: ProductsHook["dimensions"];
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function DimensionSelect({ filters, setFilter, dimensions, isOpen: isDimOpen, onOpenChange: setIsDimOpen }: DimensionSelectProps) {
  const currentDimLabel = filters.selectedDimension
    ? toPersianDigits(filters.selectedDimension)
    : "همه ابعاد";

  return (
    <div className="space-y-1 text-right">
      <label className="text-xs font-bold text-foreground block">
        ابعاد کاشی و سرامیک
      </label>

      <Dropdown isOpen={isDimOpen} onOpenChange={setIsDimOpen}>
        <Button
          variant="secondary"
          className="w-full justify-between h-14 px-3.5 rounded-2xl bg-muted/5 text-foreground font-semibold text-xs flex items-center cursor-pointer hover:bg-muted/10 transition-colors"
        >
          <span>{currentDimLabel}</span>
          <ChevronDownIcon
            size={16}
            className={cn(
              "text-muted transition-transform duration-200",
              isDimOpen && "rotate-180",
            )}
          />
        </Button>

        <Dropdown.Popover
          dir="rtl"
          placement="bottom"
          shouldFlip={false}
          className="w-[var(--trigger-width)] text-right max-h-56 overflow-y-auto scrollbar-none rounded-2xl p-1.5 bg-surface z-60  border border-border/20"
        >
          <Dropdown.Menu
            dir="rtl"
            className="text-right"
            selectionMode="single"
            selectedKeys={
              new Set([String(dimensions.find((dim) => dim.name === filters.selectedDimension)?.id ?? "all")])
            }
            onSelectionChange={(keys) => {
              const selected = Array.from(keys)[0] as string;
              setFilter(
                "selectedDimension",
                !selected || selected === "all" ? null : dimensions.find((dim) => String(dim.id) === selected)?.name ?? null,
              );
              setIsDimOpen(false);
            }}
          >
            <Dropdown.Item
              id="all"
              dir="rtl"
              textValue="همه ابعاد"
              className={cn(
                "rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer transition-colors flex items-center justify-start text-right w-full",
                !filters.selectedDimension
                  ? "bg-primary/15 text-primary"
                  : "hover:bg-default/20",
              )}
            >
              <Label className="cursor-pointer text-right w-full">
                همه ابعاد
              </Label>
            </Dropdown.Item>

            {dimensions.map((dim) => {
              const isSelected = filters.selectedDimension === dim.name;

              return (
                <Dropdown.Item
                  key={dim.id}
                  id={String(dim.id)}
                  dir="rtl"
                  textValue={dim.name}
                  className={cn(
                    "rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer transition-colors flex items-center justify-start text-right w-full",
                    isSelected
                      ? "bg-primary/15 text-primary"
                      : "hover:bg-default/20",
                  )}
                >
                  <Label className="cursor-pointer text-right w-full">
                    {toPersianDigits(dim.name)}
                  </Label>
                </Dropdown.Item>
              );
            })}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </div>
  );
}
