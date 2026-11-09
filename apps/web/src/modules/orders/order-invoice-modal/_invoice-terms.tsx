import type { Order } from "@/modules/orders/order-types"

interface InvoiceTermsProps {
  order: Order;
}

export function InvoiceTerms({ order }: InvoiceTermsProps) {
  return (
      <div className="p-3 bg-default-100 rounded-2xl text-[11px] sm:text-xs text-foreground/80 space-y-1 leading-normal print:p-2 print:text-[8px] print:space-y-0.5 print:rounded-xl">
        <span className="font-bold text-foreground block">
          شرایط و ضوابط رسمی:
        </span>
        <p>
          • بارگیری و تحویل کالا از انبار مرکزی با ارائه تاییدیه مالی
          حواله رسمی معتبر خواهد بود.
        </p>
        <p>
          • تغییرات احتمالی متراژ و هزینه حمل تا مقصد به عهده خریدار
          محترم می‌باشد.
        </p>
        {order.notes && (
          <p className="pt-0.5 text-foreground font-semibold">
            <strong>توضیحات سفارش:</strong> {order.notes}
          </p>
        )}
      </div>
  );
}
