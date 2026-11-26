import { useEffect, useLayoutEffect, useRef } from "react"
import { formatPersianDateTime } from '@/lib/utils/date'
import { formatTrackingNumber } from '@/lib/utils/tracking-number'
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import type { Order } from "@/modules/orders/order-types"
import { InvoiceActionBar } from "./_invoice-action-bar"
import { InvoiceHeader } from "./_invoice-header"
import { InvoiceBuyerCard } from "./_invoice-buyer-card"
import { InvoiceItemsTable } from "./_invoice-items-table"
import { InvoiceTotals } from "./_invoice-totals"
import { InvoiceTerms } from "./_invoice-terms"
import { InvoiceSignatures } from "./_invoice-signatures"

export interface OrderInvoiceModalProps {
  order: Order | null;
  savedAt?: number;
  isOpen: boolean;
  onClose: () => void;
}

export function OrderInvoiceModal({
  order,
  savedAt,
  isOpen,
  onClose,
}: OrderInvoiceModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  });

  const hasOrder = Boolean(order);

  useEffect(() => {
    if (!isOpen || !hasOrder) return;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      if (previouslyFocused && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [isOpen, hasOrder]);

  if (!order) return null;

  // Financial calculations
  const subtotal = order.subtotal ?? 0;
  const discountAmount = order.discountAmount ?? 0;
  const taxAmount = order.taxAmount ?? 0;
  const finalTotal = order.finalTotal ?? subtotal;

  const formattedInvoiceNumber = formatTrackingNumber(order.orderNumber || order.id);

  const handlePrint = () => {
    const originalTitle = document.title;
    const restore = () => {
      document.title = originalTitle;
    };
    document.title = `پیش‌فاکتور_${formattedInvoiceNumber.replace(/\s+/g, "_")}`;
    window.addEventListener("afterprint", restore, { once: true });
    window.print();
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={dialogRef}
          tabIndex={-1}
          id="order-invoice-portal"
          key="invoice-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="invoice-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs overflow-y-auto overscroll-contain print:static print:p-0 print:bg-white print:overflow-visible print:z-auto print:block print:w-full print:m-0"
        >
          <div className="min-h-full w-full flex flex-col items-center justify-start p-1.5 sm:p-4 md:p-6 pb-12 sm:pb-16 print:p-0 print:block print:w-full print:m-0">
            {/* Action Bar (Squircle on screen, hidden in print) */}
            <InvoiceActionBar
              formattedInvoiceNumber={formattedInvoiceNumber}
              onClose={onClose}
              onPrint={handlePrint}
            />

            {/* Printable Invoice Sheet (Squircle rounded-3xl on screen, crisp rectangular on print) */}
            <div
              id="printable-invoice"
              className="w-full max-w-4xl bg-surface text-foreground rounded-2xl sm:rounded-3xl shadow-2xl p-3 sm:p-8 md:p-10 border-none print:rounded-none print:shadow-none print:px-5 print:py-2 print:m-0 print:w-full print:max-w-none text-start font-sans select-text box-border mx-auto"
              dir="rtl"
            >
              <InvoiceHeader order={order} formattedInvoiceNumber={formattedInvoiceNumber} />

              {savedAt && <p className="mb-3 text-xs text-muted no-print">
                نسخهٔ ذخیره‌شدهٔ سند · آخرین دریافت {formatPersianDateTime(savedAt)}
              </p>}

              <InvoiceBuyerCard order={order} />

              {/* Table with horizontal scroll in preview, flush in print */}
              <InvoiceItemsTable order={order} />

              {/* 4. Financial Totals (بدون باکس خالی اضافی) */}
              <InvoiceTotals
                subtotal={subtotal}
                discountAmount={discountAmount}
                taxAmount={taxAmount}
                finalTotal={finalTotal}
              />

              {/* شرایط و ضوابط */}
              <InvoiceTerms order={order} />

              {/* 5. Signatures and Seals */}
              <InvoiceSignatures />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
