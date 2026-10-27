import { useState } from "react";
import { Drawer, Dropdown, Button, Label, Switch } from "@heroui/react";
import { StarIcon } from "@solar-icons/react/bold";
import { useProducts } from "./product-store";
import {
  RefreshCwIcon,
  ChevronDownIcon,
  XIcon,
} from "../../components/ui/icons";
import { toPersianDigits } from "../../lib/utils/currency";
import { cn } from "../../lib/utils";

export interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  productHook?: ReturnType<typeof useProducts>;
  catalogHook?: ReturnType<typeof useProducts>;
}

const AVAILABLE_DIMENSIONS = [
  "30×90",
  "60×120",
  "80×160",
  "100×100",
  "120×240",
  "60×60",
  "30×60",
  "20×120",
];

const AVAILABLE_GRADES = ["درجه ۱", "درجه ۲", "درجه ۳", "درجه ۴"] as const;

const SORT_OPTIONS = [
  { id: "default", label: "پیش‌فرض" },
  { id: "cheapest", label: "ارزان‌ترین" },
  { id: "expensive", label: "گران‌ترین" },
  { id: "newest", label: "جدیدترین" },
  { id: "oldest", label: "قدیمی‌ترین" },
] as const;

export function FilterDrawer({
  isOpen,
  onClose,
  productHook,
  catalogHook,
}: FilterDrawerProps) {
  const hook = productHook || catalogHook!;

  const { filters, toggleArrayFilter, setFilter, resetFilters, dimensions } =
    hook;

  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isDimOpen, setIsDimOpen] = useState(false);

  const currentSortLabel =
    SORT_OPTIONS.find((s) => s.id === filters.sortBy)?.label || "پیش‌فرض";

  const allDimensions =
    dimensions && dimensions.length > 0 ? dimensions : AVAILABLE_DIMENSIONS;

  const currentDimLabel = filters.selectedDimension
    ? toPersianDigits(filters.selectedDimension)
    : "همه ابعاد";

  return (
    <Drawer>
      <Drawer.Backdrop
        isOpen={isOpen}
        onOpenChange={(open) => !open && onClose()}
        className="fixed z-50 backdrop-blur-xs min-h-60 flex items-end justify-center fade-up transition-all duration-300"
      >
        <Drawer.Content
          placement="bottom"
          className="w-full max-w-xl mx-auto fixed z-50 bottom-0! mb-0! inset-x-0 top-auto h-auto! max-h-[88dvh] sm:max-h-[85dvh] rounded-t-3xl rounded-b-none! flex flex-col overflow-hidden border-b-0! shadow-2xl"
        >
          <Drawer.Dialog className="flex flex-col h-auto! max-h-[88dvh] sm:max-h-[85dvh] min-h-0 bg-surface outline-none text-start overscroll-contain m-0! mb-0! p-0! rounded-b-none!">
            <div className="flex justify-center w-full shrink-0 pt-2.5 pb-1">
              <Drawer.Handle className="w-16 h-1.5 rounded-full" />
            </div>

            <Drawer.Header className="w-full flex flex-row! items-center justify-between px-5 pt-2 pb-2 shrink-0">
              <Drawer.Heading className="w-full text-sm font-extrabold text-foreground flex items-center gap-2">
                <span> مرتب‌سازی</span>
              </Drawer.Heading>

              <Button
                type="button"
                onClick={onClose}
                aria-label="بستن"
                className="size-10 rounded-2xl bg-muted/10 hover:bg-muted/20 text-muted hover:text-foreground flex items-center justify-center cursor-pointer transition-colors shrink-0"
              >
                <XIcon />
              </Button>
            </Drawer.Header>

            {/* Body */}
            <Drawer.Body className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-3 space-y-3 scrollbar-none">
              {/* Only In Stock */}
              <div
                className="py-4 px-4 rounded-2xl bg-muted/5 flex items-center justify-between cursor-pointer select-none"
                onClick={() => setFilter("onlyInStock", !filters.onlyInStock)}
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
                    setFilter("onlyInStock", isSelected)
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

              {/* Sorting */}
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
                    className="w-[var(--trigger-width)] text-right rounded-2xl p-1.5 bg-surface z-60 shadow-xl border border-border/20"
                  >
                    <Dropdown.Menu
                      dir="rtl"
                      className="text-right"
                      selectionMode="single"
                      selectedKeys={new Set([filters.sortBy || "default"])}
                      onSelectionChange={(keys) => {
                        const selected = Array.from(keys)[0] as string;
                        if (selected) setFilter("sortBy", selected as any);
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

              {/* Dimensions */}
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
                    className="w-[var(--trigger-width)] text-right max-h-56 overflow-y-auto scrollbar-none rounded-2xl p-1.5 bg-surface z-60 shadow-xl border border-border/20"
                  >
                    <Dropdown.Menu
                      dir="rtl"
                      className="text-right"
                      selectionMode="single"
                      selectedKeys={
                        new Set([filters.selectedDimension || "all"])
                      }
                      onSelectionChange={(keys) => {
                        const selected = Array.from(keys)[0] as string;
                        setFilter(
                          "selectedDimension",
                          !selected || selected === "all" ? null : selected,
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

                      {allDimensions.map((dim) => {
                        const isSelected = filters.selectedDimension === dim;

                        return (
                          <Dropdown.Item
                            key={dim}
                            id={dim}
                            dir="rtl"
                            textValue={dim}
                            className={cn(
                              "rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer transition-colors flex items-center justify-start text-right w-full",
                              isSelected
                                ? "bg-primary/15 text-primary"
                                : "hover:bg-default/20",
                            )}
                          >
                            <Label className="cursor-pointer text-right w-full">
                              {toPersianDigits(dim)}
                            </Label>
                          </Dropdown.Item>
                        );
                      })}
                    </Dropdown.Menu>
                  </Dropdown.Popover>
                </Dropdown>
              </div>

              {/* Quality Grade */}
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
            </Drawer.Body>

            {/* Footer */}
            <Drawer.Footer className="px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] bg-surface grid grid-cols-2 gap-3 shrink-0 border-t border-border/10">
              <Button
                type="button"
                onClick={resetFilters}
                className="h-12 w-full px-4 rounded-2xl bg-muted/10 hover:bg-muted/20 text-foreground text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <RefreshCwIcon size={14} />
                <span>پاک کردن</span>
              </Button>

              <Button
                type="button"
                onClick={onClose}
                className="h-12 px-4 w-full rounded-2xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <span>
                  مشاهده نتایج ({toPersianDigits(hook.products.length)})
                </span>
              </Button>
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}
