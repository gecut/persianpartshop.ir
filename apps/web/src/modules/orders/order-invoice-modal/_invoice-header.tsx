import type { Order } from "@/modules/orders/order-types"
import { formatPersianDate } from "@/lib/utils/date"

interface InvoiceHeaderProps {
  order: Order;
  formattedInvoiceNumber: string;
}

export function InvoiceHeader({ order, formattedInvoiceNumber }: InvoiceHeaderProps) {
  return (
      <div className="mb-4 sm:mb-5 print:mb-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 print:flex-row print:items-center print:gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 print:gap-2.5">
            <div className="size-10 sm:size-11 rounded-xl sm:rounded-2xl overflow-hidden flex items-center justify-center shrink-0 print:size-9 print:rounded-xl">
              <img
                src="/assets/images/persian-part-logo.png"
                alt="بازرگانی زمانیان"
                className="size-full object-contain rounded-xl sm:rounded-2xl print:rounded-xl"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <h1 className="text-sm sm:text-lg font-black text-foreground tracking-tight whitespace-nowrap print:text-sm">
                بازرگانی زمانیان
              </h1>
              <span className="text-xs font-bold text-muted print:text-[9px]">
                پیش‌فاکتور فروش
              </span>
            </div>
          </div>

          <div className="w-full sm:w-auto bg-default-100 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 min-w-0 sm:min-w-48 text-[11px] sm:text-xs space-y-1 sm:space-y-1.5 print:p-2 print:space-y-1 print:text-[9px] print:rounded-xl">
            <div className="flex items-center justify-between gap-3 whitespace-nowrap print:gap-2">
              <span className="text-muted font-semibold">
                شماره پیش‌فاکتور:
              </span>
              <span className="font-bold text-foreground">
                {formattedInvoiceNumber}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 whitespace-nowrap print:gap-2">
              <span className="text-muted font-semibold">
                تاریخ صدور:
              </span>
              <span className="font-bold text-foreground">
                {formatPersianDate(order.createdAt || order.date)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 whitespace-nowrap print:gap-2">
              <span className="text-muted font-semibold">
                اعتبار پیش‌فاکتور:
              </span>
              <span className="font-semibold text-foreground/80">
                ۲۴ ساعت
              </span>
            </div>
          </div>
        </div>
      </div>
  );
}
