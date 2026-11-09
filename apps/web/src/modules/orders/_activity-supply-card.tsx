import { TrackingNumber } from '@/components/ui/tracking-number'
import React from 'react'
import { Button } from '@heroui/react'
import type { ActivityFeedItem } from '@persianpart/contract'
import { Badge } from '@/components/ui/badge'
import { formatToman, toPersianDigits } from '@/lib/utils/currency'
import { formatPersianDate, formatPersianDateTime } from '@/lib/utils/date'
import { formatUnit } from '@/lib/utils/unit'
import { ArrowLeftIcon, TomanIcon } from '@/components/ui/icons'

export function getSupplyStatusColor(status: string): 'primary' | 'warning' | 'success' | 'danger' | 'secondary' {
  if (status === 'supplied') return 'success'
  if (['unavailable', 'cancelled_by_customer'].includes(status)) return 'danger'
  if (status === 'reviewing') return 'warning'
  return 'primary'
}

// Supply Polymorphic Card
export const ActivitySupplyCard = React.memo(function ActivitySupplyCard({
  item,
  onOpenDetail,
}: {
  item: Extract<ActivityFeedItem, { kind: 'supply' }>
  onOpenDetail: (id: number | string) => void
}) {
  const pallet =
    item.cartonsPerPallet && item.packageCount >= item.cartonsPerPallet
      ? Math.floor(item.packageCount / item.cartonsPerPallet)
      : 0
  const remainder =
    item.cartonsPerPallet && pallet > 0 ? item.packageCount % item.cartonsPerPallet : item.packageCount

  return (
    <div className="p-4 space-y-3 rounded-2xl bg-muted/3 select-none">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-2 pb-2 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-2">
          <TrackingNumber value={item.requestNumber} />
          <Badge variant={getSupplyStatusColor(item.status)} size="sm">
            {item.statusLabel}
          </Badge>
        </div>

        <span className="text-xs text-muted font-medium">
          {formatPersianDate(item.createdAt)}
        </span>
      </div>

      {/* Product & quantity info */}
      <div className="space-y-2 min-w-0">
        <div className="flex items-center gap-3">
          <img
            src={item.productImage || '/assets/images/placeholder.svg'}
            alt={item.productName}
            className="size-13 border border-primary/20 rounded-2xl object-cover shrink-0 select-none"
            loading="lazy"
            onError={(e) => {
              const target = e.currentTarget
              if (!target.src.endsWith('/assets/images/placeholder.svg')) {
                target.src = '/assets/images/placeholder.svg'
              }
            }}
          />
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold text-foreground truncate">{item.productName}</h4>
            <p className="text-xs text-muted mt-0.5">
              درخواستی: {toPersianDigits(item.requestedQuantity)} {formatUnit(item.unit)} (معادل{' '}
              {toPersianDigits(item.roundedQuantity)} {formatUnit(item.unit)})
            </p>
            <p className="text-[11px] text-muted">
              بسته‌بندی:{' '}
              {pallet > 0
                ? `${toPersianDigits(pallet)} پالت${remainder ? ` و ${toPersianDigits(remainder)} کارتن` : ''}`
                : `${toPersianDigits(item.packageCount)} بسته`}
            </p>
          </div>
        </div>

        {/* Due date status */}
        {['new', 'reviewing'].includes(item.status) && (
          <div className="text-xs">
            {item.isOverdue ? (
              <span className="text-danger font-semibold">مهلت بررسی گذشته است</span>
            ) : (
              <span className="text-muted">مهلت پاسخ: {formatPersianDateTime(item.responseDueAt)}</span>
            )}
          </div>
        )}

        {/* Financials & Action Buttons */}
        <div className="flex items-center justify-between gap-2 pt-2">
          <div>
            <span className="text-xs text-muted block font-medium leading-tight mb-0.5">
              مبلغ برآوردی:
            </span>
            <span className="text-sm font-bold text-foreground inline-flex items-center gap-1">
              <span>{formatToman(item.estimatedTotal)}</span>
              <TomanIcon className="size-3.5" />
            </span>
          </div>

          <Button
            type="button"
            size="sm"
            variant="primary"
            onPress={() => onOpenDetail(item.id)}
            className="h-10 px-4 rounded-2xl font-bold text-xs"
          >
            پیگیری
            <ArrowLeftIcon size={13} />
          </Button>
        </div>
      </div>
    </div>
  )
})
