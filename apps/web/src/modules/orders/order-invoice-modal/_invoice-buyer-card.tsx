import type { Order } from "@/modules/orders/order-types"
import { toPersianDigits } from "@/lib/utils/currency"

interface InvoiceBuyerCardProps {
  order: Order;
}

export function InvoiceBuyerCard({ order }: InvoiceBuyerCardProps) {
  return (
      <div className="mb-3 sm:mb-4 px-3 py-2 bg-default-100 rounded-xl flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] sm:text-xs print:px-2.5 print:py-1.5 print:gap-x-4 print:text-[8.5px]">
        <span className="font-extrabold text-foreground">خریدار</span>
        <span>
          <span className="text-muted">نام: </span>
          <strong className="text-foreground font-bold">
            {order.customerName || "—"}
          </strong>
        </span>
        <span>
          <span className="text-muted">همراه: </span>
          <span className="text-foreground font-semibold">
            {order.customerPhone ? toPersianDigits(order.customerPhone) : "—"}
          </span>
        </span>
        {order.storeName && (
          <span>
            <span className="text-muted">فروشگاه: </span>
            <strong className="text-foreground font-bold">
              {order.storeName}
            </strong>
          </span>
        )}
      </div>
  );
}
