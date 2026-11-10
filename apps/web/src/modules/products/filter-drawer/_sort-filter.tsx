import { Dropdown, Button, Label } from "@heroui/react"
import { useProducts } from "@/modules/products/product-store"
import { ChevronDownIcon } from "@/components/ui/icons"
import { cn } from "@/lib/utils"

type ProductsHook = ReturnType<typeof useProducts>;

const SORT_OPTIONS = [
  { id: "default", label: "پیش‌فرض" },
  { id: "cheapest", label: "ارزان‌ترین" },
  { id: "expensive", label: "گران‌ترین" },
  { id: "newest", label: "جدیدترین" },
  { id: "oldest", label: "قدیمی‌ترین" },
] as const;

interface SortFilterProps {
  filters: ProductsHook["filters"];
  dispatchFilter: ProductsHook["dispatchFilter"];
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function SortFilter({ filters, dispatchFilter, isOpen: isSortOpen, onOpenChange: setIsSortOpen }: SortFilterProps) {
  const currentSortLabel =
    SORT_OPTIONS.find((s) => s.id === filters.sortBy)?.label || "پیش‌فرض";

  return (
    <div className="space-y-1">
      <label className="text-xs font-bold text-foreground block">
        مرتب‌سازی بر اساس
      </label>

      <Dropdown isOpen={isSortOpen} onOpenChange={setIsSortOpen}>
        <Button
          variant="secondary"
          className="w-full justify-between h-14 px-3.5 rounded-2xl bg-muted/5 text-foreground font-semibold text-xs flex items-center cursor-pointer hover:bg-muted/10 transition-colors"
        >
          <span>{currentSortLabel}</span>
          <ChevronDownIcon
            size={16}
            className={cn(
              "text-muted transition-transform duration-200",
              isSortOpen && "rotate-180",
            )}
          />
        </Button>

        <Dropdown.Popover
          dir="rtl"
          placement="bottom"
          shouldFlip={false}
          className="w-[var(--trigger-width)] text-right rounded-2xl p-1.5 bg-surface z-60  border border-border/20"
        >
          <Dropdown.Menu
            dir="rtl"
            className="text-right"
            selectionMode="single"
            selectedKeys={new Set([filters.sortBy || "default"])}
            onSelectionChange={(keys) => {
              const selected = SORT_OPTIONS.find((opt) => opt.id === Array.from(keys)[0]);
              if (selected) dispatchFilter({ type: "sortBy", sort: selected.id });
              setIsSortOpen(false);
            }}
          >
            {SORT_OPTIONS.map((opt) => {
              const isSelected = filters.sortBy === opt.id;

              return (
                <Dropdown.Item
                  key={opt.id}
                  id={opt.id}
                  dir="rtl"
                  textValue={opt.label}
                  className={cn(
                    "rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer transition-colors flex items-center justify-start text-right w-full",
                    isSelected
                      ? "bg-primary/15 text-primary"
                      : "hover:bg-default/20",
                  )}
                >
                  <Label className="cursor-pointer text-right w-full">
                    {opt.label}
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
