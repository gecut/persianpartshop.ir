
import { useNavigate, Link } from "@tanstack/react-router"
import { selectionStore, type useProductSelection } from "@/modules/products/selection-store"
import { toPersianDigits } from "@/lib/utils/currency"
import { ArrowLeftIcon } from "@/components/ui/icons"

interface ProductOrderCtaProps {
  activeFlow: "supply" | "order";
  supplyId: number | undefined;
  selectedCount: number;
  busy: boolean;
  warehouse: ReturnType<typeof useProductSelection>["warehouse"];
}

export function ProductOrderCta({ activeFlow, supplyId, selectedCount, busy, warehouse }: ProductOrderCtaProps) {
  const navigate = useNavigate();

  return (
    <div className="fixed bottom-24 start-1/2 translate-x-1/2 z-40 flex flex-col items-center gap-2 max-w-[calc(100%-2rem)]">
      <Link
        to={
          activeFlow === "supply" ? "/product/supply/$id" : "/product/new"
        }
        params={{ id: String(supplyId ?? "") }}
        onClick={(event) => {
          if (activeFlow !== "order") return;
          event.preventDefault();
          if (busy) return;
          void selectionStore.revalidate().then(() => {
            const current = selectionStore.getSnapshot();
            if (
              !current.error &&
              current.warehouse &&
              current.quotes.length === current.selectedIds.length &&
              current.selectedIds.length
            )
              void navigate({ to: "/product/new" });
          });
        }}
        className="control-height-12 px-5 bg-control-emphasis text-background flex items-center gap-3 whitespace-nowrap active:scale-95 transition-transform hover:bg-control-emphasis-hover"
      >
        <span className="min-w-6 h-6 px-1.5 rounded-lg bg-success/15 text-success font-bold text-xs flex items-center justify-center">
          {toPersianDigits(activeFlow === "supply" ? 1 : selectedCount)}
        </span>
        <span className="text-sm font-bold">
          {activeFlow === "supply"
            ? "درخواست تأمین"
            : busy
            ? "در حال بررسی…"
            : warehouse
            ? `ثبت سفارش · ${warehouse.name}`
            : "ثبت سفارش"}
        </span>
        <ArrowLeftIcon size={16} />
      </Link>
    </div>
  );
}
