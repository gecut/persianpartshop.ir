import { TrackingNumber } from '@/components/ui/tracking-number'
import React from 'react'
import { Link } from '@tanstack/react-router'
import { Button } from '@heroui/react'
import type { ActivityFeedItem } from '@persianpart/contract'
import { Badge } from '@/components/ui/badge'
import { formatToman, toPersianDigits } from '@/lib/utils/currency'
import { formatPersianDate } from '@/lib/utils/date'
import { RefreshCwIcon, ArrowLeftIcon, TomanIcon } from '@/components/ui/icons'

export function getOrderStatusColor(status: string): 'primary' | 'warning' | 'success' | 'danger' {
  if (['completed', 'approve', 'approved'].includes(status)) return 'success'
  if (['cancel', 'cancelled', 'cancelled_by_customer', 'cancelled_by_admin'].includes(status)) return 'danger'
  if (status === 'pending') return 'warning'
  return 'primary'
}

// Order Polymorphic Card
export const ActivityOrderCard = React.memo(function ActivityOrderCard({
  item,
  onReorder,
}: {
  item: Extract<ActivityFeedItem, { kind: 'order' }>
  onReorder: (orderId: string | number) => void
}) {
  const isCancelled = ['cancel', 'cancelled', 'cancelled_by_customer', 'cancelled_by_admin'].includes(item.status)

  return (
    <div className="p-4 space-y-3 rounded-2xl bg-muted/3 select-none">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-2 pb-2 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-2">
          <TrackingNumber value={item.orderNumber || item.id} />
          <Badge variant={getOrderStatusColor(item.status)} size="sm">
            {item.statusLabel}
          </Badge>
        </div>

        <span className="text-xs text-muted font-medium">
          {formatPersianDate(item.createdAt)}
        </span>
      </div>

      {/* Thumbnails & summary */}
      <div className="space-y-2 min-w-0">
        {item.productImages.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none">
            {item.productImages.map((img, idx) => (
              <img
                key={idx}
                src={img || '/assets/images/placeholder.svg'}
                alt=""
                className="size-13 border border-primary/20 rounded-2xl object-cover shrink-0 select-none"
                loading="lazy"
                onError={(e) => {
                  const target = e.currentTarget
                  if (!target.src.endsWith('/assets/images/placeholder.svg')) {
                    target.src = '/assets/images/placeholder.svg'
                  }
                }}
              />
            ))}
          </div>
        )}

        <div className="w-full flex items-center gap-2 font-bold rounded-lg py-3 px-4 bg-foreground text-background text-xs">
          <span>{toPersianDigits(item.itemCount)} قلم کالا</span>
          {item.quantitySummary && <span className="text-background/70">{item.quantitySummary}</span>}
        </div>

        {/* Financials & Action Buttons */}
        <div className="flex items-center justify-between gap-2 pt-2">
          <div>
            <span className="text-xs text-muted block font-medium leading-tight mb-0.5">
              مبلغ کل:
            </span>
            <span className="text-sm font-bold text-foreground inline-flex items-center gap-1">
              <span>{formatToman(item.totalAmount)}</span>
              <TomanIcon className="size-3.5" />
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {!isCancelled && item.canReorder && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onPress={() => onReorder(item.id)}
                className="control-height-10 px-4 bg-muted/10 hover:bg-muted/15 text-foreground text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95 shrink-0"
                aria-label="سفارش مجدد اقلام"
              >
                <RefreshCwIcon size={13} />
                <span>تکرار</span>
              </Button>
            )}

            <Link
              to="/orders/$id"
              params={{ id: String(item.id) }}
              className="control-height-10 px-4 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95 shrink-0"
            >
              <span>پیگیری</span>
              <ArrowLeftIcon size={13} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
})
