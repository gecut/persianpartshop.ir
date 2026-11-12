import { useState } from "react"
import { Drawer, Button } from "@heroui/react"
import { useProducts } from "@/modules/products/product-store"
import { RefreshCwIcon, XIcon } from "@/components/ui/icons"
import { toPersianDigits } from "@/lib/utils/currency"
import { InStockFilter } from "./_in-stock-filter"
import { SortFilter } from "./_sort-filter"
import { DimensionSelect } from "./_dimension-select"
import { GradeFilter } from "./_grade-filter"


export interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  productHook?: ReturnType<typeof useProducts>;
  catalogHook?: ReturnType<typeof useProducts>;
  supplyMode?: boolean;
}


export function FilterDrawer({
  isOpen,
  onClose,
  productHook,
  catalogHook,
  supplyMode = false,
}: FilterDrawerProps) {
  const hook = productHook || catalogHook!;

  const { filters, toggleArrayFilter, dispatchFilter, resetFilters, dimensions } =
    hook;


  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isDimOpen, setIsDimOpen] = useState(false);

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
                className="w-10 control-height-10 bg-muted/10 hover:bg-muted/20 text-muted hover:text-foreground flex items-center justify-center cursor-pointer transition-colors shrink-0"
              >
                <XIcon />
              </Button>
            </Drawer.Header>

            {/* Body */}
            <Drawer.Body className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-3 space-y-3 scrollbar-none">
              {/* Only In Stock */}
              {!supplyMode && <InStockFilter filters={filters} dispatchFilter={dispatchFilter} />}

              {/* Sorting */}
              <SortFilter
                filters={filters}
                dispatchFilter={dispatchFilter}
                isOpen={isSortOpen}
                onOpenChange={setIsSortOpen}
              />

              {/* Dimensions */}
              <DimensionSelect
                filters={filters}
                dispatchFilter={dispatchFilter}
                dimensions={dimensions}
                isOpen={isDimOpen}
                onOpenChange={setIsDimOpen}
              />

              {/* Quality Grade */}
              <GradeFilter filters={filters} toggleArrayFilter={toggleArrayFilter} />

            </Drawer.Body>

            {/* Footer */}
            <Drawer.Footer className="px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] bg-surface grid grid-cols-2 gap-3 shrink-0 border-t border-border/10">
              <Button
                type="button"
                onClick={resetFilters}
                className="control-height-12 w-full px-4 bg-muted/10 hover:bg-muted/20 text-foreground text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <RefreshCwIcon size={14} />
                <span>پاک کردن</span>
              </Button>

              <Button
                type="button"
                onClick={onClose}
                className="control-height-12 px-4 w-full bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
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
