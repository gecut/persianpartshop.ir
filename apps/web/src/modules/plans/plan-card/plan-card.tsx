import { useState } from "react"
import type { Plan } from "@/modules/plans/plan-types"
import type { Product } from "@/modules/products/product-types"
import { cn } from "@/lib/utils"
import { ArrowLeftIcon, ClockIcon } from "@/components/ui/icons"
import { ProductBottomSheet } from "@/modules/products/product-bottom-sheet/product-bottom-sheet"
import { useAuth } from "@/modules/auth/auth-store"
import { usePlanTimeStatus } from "./_use-plan-time-status"
import { usePlanProducts } from "./_use-plan-products"
import { PlanConditionsSheet } from "./_plan-conditions-sheet"

export interface PlanCardProps {
  plan: Plan;
  products: Product[];
}

export function PlanCard({ plan, products }: PlanCardProps) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedProductForDetail, setSelectedProductForDetail] =
    useState<Product | null>(null);
  const { user } = useAuth();
  const isOrderingDisabled =
    Boolean(user?.disableOrdering) || Boolean(user?.hideExactStock);

  // Time & Status computations
  const {
    isUpcoming,
    upcomingDaysText,
    isExpired,
    isActive,
    timeBadgeText,
    timeBadgeClass,
  } = usePlanTimeStatus(plan);

  const planProducts = usePlanProducts(plan, products, user);

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsDetailsOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsDetailsOpen(true);
          }
        }}
        className={cn(
          "p-5 flex flex-col bg-muted/5 hover:bg-muted/10 gap-3 text-start transition-all h-fit rounded-2xl text-foreground relative overflow-hidden cursor-pointer select-none active:scale-[0.99]",
          isExpired && "opacity-80 border-danger/25",
          !isActive && !isUpcoming && !isExpired && "opacity-85",
        )}
      >
        {/* Title */}
        <h3 className="text-xs sm:text-base font-bold text-foreground leading-snug line-clamp-1">
          {plan.title}
        </h3>

        <div className="w-full flex items-center justify-between">
          <div className="flex items-center justify-start gap-2 flex-wrap">
            <div className="shrink-0">
              {isExpired ? (
                <span className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-danger/15 text-danger whitespace-nowrap inline-flex items-center shrink-0">
                  منقضی شده
                </span>
              ) : isUpcoming ? (
                <span className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-warning/15 text-warning whitespace-nowrap inline-flex items-center shrink-0">
                  در انتظار شروع
                </span>
              ) : (
                <span className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-success/15 text-success whitespace-nowrap inline-flex items-center shrink-0">
                  فعال
                </span>
              )}
            </div>

            {timeBadgeText && (
              <div className="shrink-0">
                <span
                  className={cn(
                    "px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap inline-flex items-center gap-1.5 shrink-0",
                    timeBadgeClass,
                  )}
                >
                  <ClockIcon size={12} className="shrink-0" />
                  <span>{timeBadgeText}</span>
                </span>
              </div>
            )}
          </div>
          <div className="text-xs w-fit flex items-center justify-end font-semibold px-3 rounded-2xl text-primary transition-colors duration-200">
            <ArrowLeftIcon />
          </div>
        </div>
      </div>
      <PlanConditionsSheet
        plan={plan}
        planProducts={planProducts}
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        isExpired={isExpired}
        isUpcoming={isUpcoming}
        isActive={isActive}
        upcomingDaysText={upcomingDaysText}
        isOrderingDisabled={isOrderingDisabled}
        onSelectProduct={setSelectedProductForDetail}
      />
      {/* Product Details Bottom Sheet (Same as /product page) */}
      <ProductBottomSheet
        product={selectedProductForDetail}
        isOpen={Boolean(selectedProductForDetail)}
        isSelected={false}
        isOrderingDisabled={true}
        onClose={() => setSelectedProductForDetail(null)}
      />
    </>
  );
}
