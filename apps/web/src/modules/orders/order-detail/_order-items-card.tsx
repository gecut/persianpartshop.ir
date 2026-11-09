import { formatCartons, formatUnit, summarizeQuantities } from '@/lib/utils/unit'
import { Link } from "@tanstack/react-router"


import { type Order, type OrderItem } from "@/modules/orders/order-types"
import { toPersianDigits } from "@/lib/utils/currency"
import { OrderFinancialSummary } from "./_order-financial-summary"

interface OrderItemsCardProps {
  order: Order;
}

export function OrderItemsCard({ order }: OrderItemsCardProps) {
  return (
    <div className="bg-muted/5 rounded-2xl p-5 sm:p-6 space-y-4">
      <h3 className="text-sm font-extrabold text-foreground pb-1 flex items-center justify-between">
        <span>اقلام سفارش</span>
        <span className="text-xs text-muted font-normal">
          {toPersianDigits(order.items.length)} کالا انتخاب شده
          {` • مقدار تحویلی: ${summarizeQuantities(order.items.map(item => ({ unit: item.unit ?? 'm2', quantity: item.deliverableArea })))}`}
        </span>
      </h3>

      <div className="divide-y divide-separator/50">
        {order.items.map((item: OrderItem, idx: number) => (
          <div
            key={idx}
            className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <Link
                to="/product"
                search={{ productname: item.productSlug }}
                className="relative w-16 h-16 shrink-0 block hover:opacity-90 transition-opacity"
              >
                <img
                  src={item.productImage || "/assets/images/placeholder.svg"}
                  alt={item.productName}
                  className="w-16 h-16 rounded-2xl object-cover"
                  onError={(e) => {
                    if (
                      !e.currentTarget.src.endsWith(
                        "/assets/images/placeholder.svg",
                      )
                    ) {
                      e.currentTarget.src = "/assets/images/placeholder.svg";
                    }
                  }}
                />
              </Link>
              <div>
                <Link
                  to="/product"
                  search={{ productname: item.productSlug }}
                  className="text-sm font-extrabold text-foreground hover:text-primary transition-colors"
                >
                  {item.productName}
                </Link>
                <div className="flex items-center gap-2 text-xs text-muted mt-1">
                  <span>{toPersianDigits(item.dimension)}</span>
                </div>
                <div className="text-xs text-muted mt-1">
                  مقدار تحویلی:{" "}
                  <strong>
                    {toPersianDigits(
                      item.deliverableArea || item.requestedArea,
                    )}
                  </strong>{" "}
                  {formatUnit(item.unit ?? 'm2')}{item.productType !== 'other' && ` (${formatCartons(item.cartonCount, item.cartonsPerPallet)})`}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Financial Summary */}
      <OrderFinancialSummary order={order} />
    </div>
  );
}
