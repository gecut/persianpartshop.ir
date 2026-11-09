import type { Order } from "@/modules/orders/order-types"
import { FileTextIcon } from "@/components/ui/icons"

interface InvoiceBuyerCardProps {
  order: Order;
}

export function InvoiceBuyerCard({ order }: InvoiceBuyerCardProps) {
  return (
      <div className="flex w-full mb-3 sm:mb-4">
        <div className="p-3 sm:p-4 w-full bg-default-100 rounded-xl sm:rounded-2xl space-y-2 sm:space-y-2.5 text-[11px] sm:text-xs print:p-2.5 print:space-y-1 print:text-[8.5px] print:rounded-xl">
          <div className="flex items-center gap-1.5 pb-0.5 sm:pb-1 font-extrabold text-foreground text-xs sm:text-sm print:text-[9px]">
            <FileTextIcon
              size={14}
              className="print:size-3 text-muted"
            />
            <span>مشخصات خریدار (مشتری)</span>
          </div>
          <div className="space-y-1 sm:space-y-1.5 text-foreground/80 leading-normal print:space-y-0.5">
            <div className="flex items-center justify-between gap-2 whitespace-nowrap">
              <span className="text-muted">خریدار / نماینده:</span>
              <strong className="text-foreground font-bold">
                {order.customerName || "خریدار محترم"}
              </strong>
            </div>
            <div className="flex items-center justify-between gap-2 whitespace-nowrap">
              <span className="text-muted">شماره همراه:</span>
              <span
                className=" text-foreground font-semibold"
                dir="ltr"
              >
                {order.customerPhone || "—"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 whitespace-nowrap">
              <span className="text-muted">فروشگاه / شرکت:</span>
              <strong className="text-foreground">
                {order.storeName || "—"}
              </strong>
            </div>
            <div className="flex items-baseline justify-between gap-2 pt-0.5">
              <span className="text-muted shrink-0 whitespace-nowrap">
                نشانی تحویل:
              </span>
              <span className="text-foreground/80 text-left text-[11px] sm:text-xs print:text-[8px]">
                {order.deliveryAddress || "انبار مرکزی / پروژه"}
              </span>
            </div>
          </div>
        </div>
      </div>
  );
}
