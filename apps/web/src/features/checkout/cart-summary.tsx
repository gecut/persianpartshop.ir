"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Button } from "@heroui/react";
import type { Product } from "../../types";
import { useAllQuantities } from "../products/selection-store";
import { computeCartTotals } from "./cart-totals";
import { PreInvoiceModal } from "./pre-invoice-modal";
import { ArrowLeftIcon } from "../../components/ui/icons";

export interface CartSummaryProps {
  selectedProducts: Product[];
  editOrderId?: string;
  onSaveEditedOrder: () => void;
  onOrderCreated: (orderId: string) => void;
}

export function CartSummary({
  selectedProducts,
  editOrderId,
  onSaveEditedOrder,
  onOrderCreated,
}: CartSummaryProps) {
  const quantities = useAllQuantities();
  const deferredQuantities = useDeferredValue(quantities);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);

  const totals = useMemo(
    () => computeCartTotals(selectedProducts, deferredQuantities),
    [selectedProducts, deferredQuantities],
  );

  return (
    <>
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-xl bg-white/95 dark:bg-background/95 backdrop-blur-md z-40 p-4 border-t border-border/20">
        {editOrderId ? (
          <Button
            type="button"
            onPress={onSaveEditedOrder}
            isDisabled={!totals.hasValidQuantities}
            className="w-full h-12 px-4 rounded-2xl bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer select-none touch-manipulation"
          >
            <span>ذخیره تغییرات فاکتور</span>
            <ArrowLeftIcon size={16} />
          </Button>
        ) : (
          <Button
            type="button"
            onPress={() => setIsInvoiceOpen(true)}
            isDisabled={!totals.hasValidQuantities}
            className="w-full h-12 px-4 rounded-2xl bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer select-none touch-manipulation"
          >
            <span>تایید</span>
            <ArrowLeftIcon size={16} />
          </Button>
        )}
      </div>

      <PreInvoiceModal
        isOpen={isInvoiceOpen}
        onClose={() => setIsInvoiceOpen(false)}
        products={selectedProducts}
        quantities={quantities}
        editOrderId={editOrderId}
        onSuccess={onOrderCreated}
      />
    </>
  );
}