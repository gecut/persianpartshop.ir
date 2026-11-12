"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Button } from "@heroui/react";
import { catalogCoordinator } from "@/modules/products/catalog-data";

import type { Product } from "@/modules/products/product-types"
import { useAllQuantities, useProductSelection, selectionStore } from "@/modules/products/selection-store";
import { computeCartTotals } from "./cart-totals";
import { PreInvoiceModal } from "./pre-invoice-modal";
import { ArrowLeftIcon } from "@/components/ui/icons";

export interface CartSummaryProps {
  selectedProducts: Product[];
  onOrderCreated: (orderId: string) => void;
}

export function CartSummary({
  selectedProducts,
  onOrderCreated,
}: CartSummaryProps) {
  const quantities = useAllQuantities();
  const { warehouse, busy, error, selectedIds } = useProductSelection();

  const [checking, setChecking] = useState(false);
  const deferredQuantities = useDeferredValue(quantities);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);

  const totals = useMemo(
    () => computeCartTotals(selectedProducts, deferredQuantities),
    [selectedProducts, deferredQuantities],
  );

  return (
    <>
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-xl bg-white/95 dark:bg-background/95 backdrop-blur-md z-40 p-4 border-t border-border/20">
        <Button
          type="button"
          onPress={async () => {
            if (checking) return;
            setChecking(true);
            const snapshot = selectionStore.submissionSnapshot();
            const before = selectionStore.getSnapshot();
            const requested = JSON.stringify([before.selectedIds, before.quantities]);
            try {
              await selectionStore.revalidate();
              const current = selectionStore.getSnapshot();
              const after = selectionStore.submissionSnapshot();
              if (snapshot.owner !== after.owner || requested !== JSON.stringify([current.selectedIds, current.quantities])) return;
              if (!current.error && current.warehouse && current.quotes.length === current.selectedIds.length) setIsInvoiceOpen(true);
              else await catalogCoordinator.ensureIds(selectedIds, true);
            } finally { setChecking(false); }
          }}
          isDisabled={!totals.hasValidQuantities || checking || busy}
          className="w-full control-height-12 px-4 bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer select-none touch-manipulation"
        >
          <span>{checking ? "در حال بررسی موجودی…" : warehouse ? `تأیید · ${warehouse.name}` : "تأیید"}</span>
          <ArrowLeftIcon size={16} />
        </Button>
      </div>

      {error && <div role="alert" className="px-4 text-sm text-danger">{error} <Button size="sm" variant="ghost" onPress={() => void selectionStore.revalidate()}>تلاش دوباره</Button></div>}
      <PreInvoiceModal
        isOpen={isInvoiceOpen}
        onClose={() => setIsInvoiceOpen(false)}
        products={selectedProducts}
        quantities={quantities}
        onSuccess={onOrderCreated}
      />
    </>
  );
}