export function InvoiceSignatures() {
  return (
      <div className="pt-6 mt-6 print:pt-4 print:mt-4">
        <div className="grid grid-cols-2 gap-6 text-center text-xs print:gap-4 print:text-[8.5px]">
          <div className="space-y-10 print:space-y-6">
            <span className="font-extrabold text-foreground block">
              مهر و امضای امور مالی و فروش پرشین‌پارت
            </span>
            <div className="text-[10px] text-muted/70 print:text-[7.5px]">
              PersianPart Financial Dep. Stamp
            </div>
          </div>

          <div className="space-y-10 print:space-y-6">
            <span className="font-extrabold text-foreground block">
              امضا و تایید تحویل‌گیرنده / خریدار
            </span>
            <div className="text-[10px] text-muted/70 print:text-[7.5px]">
              Customer Signature & Date
            </div>
          </div>
        </div>
      </div>
  );
}
