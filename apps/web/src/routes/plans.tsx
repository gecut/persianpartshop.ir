import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { usePlans } from "../features/plans/plans-store";
import type { Plan } from "../types";
import { PlanCard } from "../features/plans/plan-card";
import { PlanCardSkeleton } from "../components/ui/skeleton";
import { ArrowLeftIcon, SparklesIcon } from "../components/ui/icons";

export const Route = createFileRoute("/plans")({
  component: CustomerPlansPage,
});

function CustomerPlansPage() {
  const { plans, allProducts, isLoading } = usePlans();
  const now = Date.now();
  const validPlans = (plans as Plan[]).filter((p: Plan) => {
    const expireTime = p.expiresAt ? new Date(p.expiresAt).getTime() : null;
    const isExpired =
      p.status === "expired" ||
      (expireTime !== null && !isNaN(expireTime) && expireTime <= now);
    return !isExpired;
  });

  const sortedPlans = useMemo(() => {
    return [...validPlans].sort((a, b) => {
      const aStart = a.startsAt ? new Date(a.startsAt).getTime() : 0;
      const bStart = b.startsAt ? new Date(b.startsAt).getTime() : 0;
      return bStart - aStart;
    });
  }, [validPlans]);

  return (
    <div className="w-full px-4 py-3 space-y-3.5 text-start">
      <div className="flex items-center justify-between gap-2"></div>
      {isLoading && plans.length === 0 ? (
        <div className="grid grid-cols-1 gap-4 items-stretch">
          <PlanCardSkeleton />
          <PlanCardSkeleton />
        </div>
      ) : sortedPlans.length === 0 ? (
        <div className="bg-muted/5 rounded-2xl p-8 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <SparklesIcon size={26} />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="text-sm font-bold text-foreground">
              طرح فعالی یافت نشد
            </h3>
            <p className="text-xs text-muted leading-relaxed">
              در حال حاضر طرح یا تخفیف فعالی برای حساب شما وجود ندارد.
            </p>
          </div>
          <Link
            to="/product"
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-2xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90"
          >
            <span>مشاهده محصولات</span>
            <ArrowLeftIcon size={14} />
          </Link>
        </div>
      ) : (
        <div className="space-y-2 gap-4 items-stretch">
          {sortedPlans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} products={allProducts} />
          ))}
        </div>
      )}
    </div>
  );
}
