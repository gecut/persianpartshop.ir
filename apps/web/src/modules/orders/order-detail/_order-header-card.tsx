import { TrackingNumber } from '@/components/ui/tracking-number'


import { Button } from "@heroui/react"
import { type Order } from "@/modules/orders/order-types"
import { Badge } from "@/components/ui/badge"
import { formatPersianDate } from "@/lib/utils/date"
import { RefreshCwIcon, XIcon, FileTextIcon } from "@/components/ui/icons"
import { CancelCountdownBadge } from "./_cancel-countdown-badge"

interface OrderHeaderCardProps {
  order: Order;
  statusColor: "danger" | "success" | "warning" | "primary";
  displayStatusLabel: string;
  isCancelled: boolean;
  isCompleted: boolean;
  isWithin60Minutes: boolean;
  timeLeftSeconds: number;
  isCancellableByCustomer: boolean;
  onShowInvoice: () => void;
  onShowCancel: () => void;
  onReorder: () => void;
}

export function OrderHeaderCard({
  order,
  statusColor,
  displayStatusLabel,
  isCancelled,
  isCompleted,
  isWithin60Minutes,
  timeLeftSeconds,
  isCancellableByCustomer,
  onShowInvoice,
  onShowCancel,
  onReorder,
}: OrderHeaderCardProps) {
  return (
    <div className="bg-muted/5 rounded-2xl p-5 sm:p-6 space-y-4">
      <div>
        <div className="flex items-center gap-2.5 mb-2 flex-wrap">
          <TrackingNumber value={order.orderNumber} />
          <Badge variant={statusColor} size="md">
            {displayStatusLabel}
          </Badge>

          {/* 60-Minute Customer Countdown Badge */}
          {!isCancelled && !isCompleted && (
            <CancelCountdownBadge
              isWithin60Minutes={isWithin60Minutes}
              timeLeftSeconds={timeLeftSeconds}
            />
          )}
        </div>
        <p className="text-xs text-muted">
          تاریخ ثبت سفارش:{" "}
          <strong className="text-foreground">
            {formatPersianDate(order.createdAt || order.date)}
          </strong>
        </p>
      </div>

      {/* Action Buttons - زیر تاریخ */}
      {isCancelled ? (
        <div className="pt-3">
          <div className="w-full py-3 px-4 rounded-2xl bg-danger/10 border border-danger/20 text-danger text-xs font-bold flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <XIcon size={16} className="shrink-0 text-danger" />
              <span>
                این سفارش لغو شده است و امکان سفارش مجدد آن وجود ندارد.
              </span>
            </div>
            {order.notes && (
              <span className="text-[11px] font-semibold text-danger/80">
                علت: {order.notes}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="pt-3 flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <Button
            type="button"
            onPress={onShowInvoice}
            className="flex-1 h-10 px-4 rounded-2xl bg-muted/10 hover:bg-muted/15 text-foreground text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <FileTextIcon size={16} />
            <span>دریافت پیش‌فاکتور</span>
          </Button>

          {isCancellableByCustomer && (
            <Button
              type="button"
              onPress={onShowCancel}
              className="flex-1 h-10 px-4 rounded-2xl bg-danger/15 text-danger hover:bg-danger/20 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <XIcon size={16} />
              <span>لغو سفارش</span>
            </Button>
          )}

          <Button
            type="button"
            onPress={onReorder}
            className="flex-1 h-10 px-4 whitespace-nowrap rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RefreshCwIcon size={16} />
            <span>سفارش مجدد</span>
          </Button>
        </div>
      )}
    </div>
  );
}
