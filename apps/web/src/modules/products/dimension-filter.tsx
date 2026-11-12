import type { Dimension } from "@persianpart/contract";
import { Button, cn } from "@heroui/react";
import { Skeleton } from "@/components/ui/skeleton";
import { toPersianDigits } from "@/lib/utils/currency";

interface DimensionFilterProps {
  dimensions: Dimension[];
  selectedDimension: string | null;
  isLoading: boolean;
  error: boolean;
  onRetry: () => void;
  onSelect: (dimension: string | null) => void;
}

export function DimensionFilter({
  dimensions,
  selectedDimension,
  isLoading,
  error,
  onRetry,
  onSelect,
}: DimensionFilterProps) {
  if (isLoading) {
    return (
      <div
        className="flex gap-1.5 overflow-hidden py-0.5 pb-1"
        aria-label="در حال دریافت ابعاد"
        aria-busy="true"
      >
        {[64, 80, 80, 88, 80, 64, 80, 80, 88, 80].map((width, index) => (
          <Skeleton
            key={index}
            className="control-height-10 shrink-0"
            style={{ width }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className="w-full overflow-x-auto pb-1 pt-0.5 scrollbar-none"
      role="group"
      aria-label="فیلتر ابعاد کاشی و سرامیک"
    >
      <div className="flex min-w-max items-center gap-1.5">
        {[null, ...dimensions].map((dimension) => {
          const selected = selectedDimension === (dimension?.name ?? null);
          return (
            <Button
              key={dimension === null ? "all" : dimension.id}
              type="button"
              aria-pressed={selected}
              onPress={() =>
                onSelect(selected ? null : dimension?.name ?? null)
              }
              className={cn(
                "control-height-10 shrink-0 group select-none whitespace-nowrap px-4 text-xs font-bold transition-colors duration-200",
                selected
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/5 hover:bg-default/20 text-foreground"
              )}
            >
              {dimension === null ? (
                "همه"
              ) : (
                <div className="flex gap-0.5 opacity-70 group-hover:opacity-100 transition-opacity duration-200">
                  <span>{toPersianDigits(dimension.height)}</span>
                  <span className="opacity-70">&times;</span>
                  <span>{toPersianDigits(dimension.width)}</span>
                </div>
              )}
            </Button>
          );
        })}
        {error && (
          <Button
            type="button"
            variant="ghost"
            onPress={onRetry}
            className="h-10 text-xs text-muted"
          >
            دریافت دوباره ابعاد
          </Button>
        )}
      </div>
    </div>
  );
}
