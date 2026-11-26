export function InvoiceSignatures() {
  return (
      <div className="pt-6 mt-6 print:pt-4 print:mt-4">
        <div className="grid grid-cols-2 gap-6 text-center text-xs print:gap-4 print:text-[8.5px]">
          <div className="h-20 print:h-16">
            <span className="font-extrabold text-foreground block">
              مهر و امضای فروشنده
            </span>
          </div>

          <div className="h-20 print:h-16">
            <span className="font-extrabold text-foreground block">
              امضا و تایید خریدار
            </span>
          </div>
        </div>
      </div>
  );
}
