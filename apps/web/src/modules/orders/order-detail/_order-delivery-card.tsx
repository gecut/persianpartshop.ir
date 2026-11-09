

import { type Order } from "@/modules/orders/order-types"
import { toPersianDigits } from "@/lib/utils/currency"
import { StoreIcon, MapPinIcon, PhoneIcon } from "@/components/ui/icons"

interface OrderDeliveryCardProps {
  order: Order;
}

export function OrderDeliveryCard({ order }: OrderDeliveryCardProps) {
  return (
    <div className="bg-muted/5 rounded-2xl p-5 sm:p-6 space-y-3">
      <h3 className="text-sm font-extrabold text-foreground pb-1">
        اطلاعات تحویل
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div className="flex items-start gap-2.5">
          <StoreIcon size={16} className="text-muted mt-0.5 shrink-0" />
          <div>
            <span className="text-muted block">فروشگاه:</span>
            <span className="font-bold text-foreground">
              {order.storeName}
              {order.warehouseName && <p>انبار تأمین: {order.warehouseName}</p>}
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <PhoneIcon size={16} className="text-muted mt-0.5 shrink-0" />
          <div>
            <span className="text-muted block">تحویل‌گیرنده:</span>
            <span className="font-bold text-foreground">
              {order.customerName} ({toPersianDigits(order.customerPhone)})
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <MapPinIcon size={16} className="text-muted mt-0.5 shrink-0" />
          <div>
            <span className="text-muted block">نشانی تحویل:</span>
            <span className="font-bold text-foreground">
              {order.deliveryAddress}
            </span>
          </div>
        </div>
      </div>

      {order.notes && (
        <div className="p-3 bg-muted/5 rounded-2xl text-xs text-muted mt-2">
          <strong>یادداشت سفارش:</strong> {order.notes}
        </div>
      )}
    </div>
  );
}
