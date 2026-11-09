import { Button } from "@heroui/react"
import { PrinterIcon, XIcon, ArrowRightIcon } from "@/components/ui/icons"

interface InvoiceActionBarProps {
  formattedInvoiceNumber: string;
  onClose: () => void;
  onPrint: () => void;
}

export function InvoiceActionBar({ formattedInvoiceNumber, onClose, onPrint }: InvoiceActionBarProps) {
  return (
    <div className="w-full max-w-4xl bg-surface rounded-2xl p-2.5 sm:p-3 mb-3 sm:mb-4 shadow-xl flex items-center justify-between gap-2 sm:gap-3 no-print sticky top-2 z-10 box-border">
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
        <Button
          type="button"
          onPress={onClose}
          aria-label="بازگشت"
          className="h-9 sm:h-10 px-2.5 sm:px-3.5 rounded-xl bg-muted/10 hover:bg-muted/15 text-foreground text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <ArrowRightIcon size={16} />
          <span>بازگشت</span>
        </Button>
        <div className="hidden sm:flex flex-col">
          <span className="text-xs font-extrabold text-foreground">
            پیش‌فاکتور رسمی سفارش
          </span>
          <span className="text-[11px] text-muted dir-ltr ">
            {formattedInvoiceNumber}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <Button
          type="button"
          onPress={onPrint}
          className="h-9 sm:h-10 px-3 sm:px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
        >
          <PrinterIcon size={16} />
          <span>چاپ / ذخیره PDF</span>
        </Button>

        <Button
          type="button"
          onPress={onClose}
          aria-label="بستن"
          className="size-9 sm:size-10 rounded-xl bg-muted/10 hover:bg-muted/20 text-muted hover:text-foreground flex items-center justify-center cursor-pointer transition-colors"
        >
          <XIcon size={16} />
        </Button>
      </div>
    </div>
  );
}
