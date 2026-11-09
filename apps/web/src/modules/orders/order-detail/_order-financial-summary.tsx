

import { type Order } from "@/modules/orders/order-types"
import { formatToman } from "@/lib/utils/currency"
import { TomanIcon } from "@/components/ui/icons"

interface OrderFinancialSummaryProps {
  order: Order;
}

export function OrderFinancialSummary({ order }: OrderFinancialSummaryProps) {
  return (
      <div className="pt-4 space-y-2 text-xs text-muted">
        {order.discountAmount > 0 && (
          <div className="flex justify-between items-center text-success font-semibold">
            <span>تخفیف:</span>
            <span className="inline-flex items-center gap-1">
              <span>- {formatToman(order.discountAmount)}</span>
              <TomanIcon className="size-3.5" />
            </span>
          </div>
        )}

        <div className="pt-2 flex justify-between items-center text-sm font-bold text-foreground">
          <span>مبلغ نهایی:</span>
          <span className="text-base font-bold text-primary inline-flex items-center gap-1">
            <span>{formatToman(order.finalTotal)}</span>
            <TomanIcon className="size-4" />
          </span>
        </div>
      </div>
  );
}
