
import { cn, SearchField, Button } from "@heroui/react"
import { AnimatePresence, motion } from "framer-motion"
import { toPersianDigits } from "@/lib/utils/currency"
import { FilterIcon, XIcon } from "@/components/ui/icons"

interface ProductSearchBarProps {
  searchQuery: string;
  canUseProductQr: boolean;
  activeFilterCount: number;
  onSearchChange: (value: string) => void;
  onScan: () => void;
  onOpenFilter: () => void;
}

export function ProductSearchBar({ searchQuery, canUseProductQr, activeFilterCount, onSearchChange, onScan, onOpenFilter }: ProductSearchBarProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1 text-base">
        <SearchField name="search">
          <SearchField.Group className="control-height-12 border-0 shadow-none bg-muted/5 px-3 flex items-center">
            <SearchField.SearchIcon />
            <SearchField.Input
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full text-sm font-base placeholder:text-sm"
              placeholder="جستجو محصولات"
            />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
        {searchQuery && (
          <Button
            type="button"
            onClick={() => onSearchChange("")}
            className="absolute end-s-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-xl text-muted hidden hover:text-foreground  items-center justify-center cursor-pointer"
            aria-label="پاک کردن متن جستجو"
          >
            <XIcon size={14} />
          </Button>
        )}
      </div>
      {canUseProductQr && (
        <Button
          type="button"
          isIconOnly
          variant="ghost"
          onPress={() => onScan()}
          aria-label="اسکن محصول"
          className="w-12 control-height-12 shrink-0 bg-muted/5 text-muted hover:bg-default/20 hover:text-foreground"
        >
          <svg
            aria-hidden="true"
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4" />
            <path d="M8 8h3v3H8zM15 8h1v1h-1zM8 15h1v1H8zM14 14h2v2h-2z" />
          </svg>
        </Button>
      )}
      <Button
        type="button"
        onClick={() => onOpenFilter()}
        aria-label="فیلترهای پیشرفته"
        className={cn(
          "w-auto control-height-12 px-4 font-bold text-xs flex items-center justify-center shrink-0 cursor-pointer active:scale-95 select-none transition-colors duration-250",
          activeFilterCount > 0
            ? "bg-control-emphasis"
            : "bg-muted/5 text-muted hover:bg-default/20 hover:text-foreground"
        )}
      >
        <FilterIcon size={16} />
        <AnimatePresence initial={false}>
          {activeFilterCount > 0 && (
            <motion.span
              key="filter-badge-wrap"
              variants={{
                initial: {
                  width: 0,
                  opacity: 0,
                  scale: 0.2,
                  marginInlineStart: 0,
                },
                animate: {
                  width: "auto",
                  opacity: [0, 0.8, 1, 1],
                  scale: [0.2, 1.25, 0.92, 1],
                  marginInlineStart: 6,
                  transition: {
                    duration: 0.28,
                    times: [0, 0.45, 0.75, 1],
                    ease: "easeOut",
                  },
                },
                exit: {
                  width: 0,
                  opacity: [1, 0.7, 0],
                  scale: [1, 1.08, 0],
                  marginInlineStart: 0,
                  transition: {
                    duration: 0.18,
                    times: [0, 0.25, 1],
                    ease: [0.4, 0, 0.2, 1],
                  },
                },
              }}
              initial="initial"
              animate="animate"
              exit="exit"
              className="overflow-hidden flex items-center justify-center shrink-0 whitespace-nowrap"
            >
              <span className="min-w-4.5 h-4.5  rounded-full bg-white text-primary text-xs font-bold flex items-center justify-center shrink-0 select-none">
                <motion.span
                  key={activeFilterCount}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                >
                  {toPersianDigits(activeFilterCount)}
                </motion.span>
              </span>
            </motion.span>
          )}
        </AnimatePresence>
      </Button>
    </div>
  );
}
