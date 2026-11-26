import type { CustomerOrderDocument } from '@persianpart/contract'
import { match, P } from 'ts-pattern'
import { catalogProductImages } from '@/lib/media-url'
import { formatPersianDate, formatPersianTimelineTs } from '@/lib/utils/date'
import { formatGrade } from '@/modules/catalog/catalog-mapper'
import type { Order, OrderItem, OrderStatus, TimelineStep } from './order-types'

export interface OrderTimelineInput {
  status: string
  cancelledBy?: 'customer' | 'admin' | null
  createdAt?: string
  updatedAt?: string
  notes?: string | null
}

export function buildFullOrderTimeline(
  doc: OrderTimelineInput,
  persianDate?: string,
  force60MinutesPassed?: boolean
): TimelineStep[] {
  const status: string = typeof doc.status === 'string' ? doc.status : 'pending'
  const cancelledBy: string | undefined = typeof doc.cancelledBy === 'string' ? doc.cancelledBy : undefined
  const pDate = persianDate || (doc.createdAt ? formatPersianDate(doc.createdAt) : '')

  const formatTs = (ts?: string) => {
    if (!ts) return undefined
    return formatPersianTimelineTs(ts, pDate)
  }

  const createdAtMs = doc.createdAt ? new Date(doc.createdAt).getTime() : Date.now()
  const is60MinutesPassed = force60MinutesPassed ?? (Date.now() >= createdAtMs + 60 * 60 * 1000)

  // Cancellation Flow
  const cancelConfig = match([status, cancelledBy] as const)
    .with([P.union('cancel', 'cancelled', 'cancelled_by_customer', 'cancelled_by_admin'), P._], () => {
      const isCancelledByCustomer = status === 'cancelled_by_customer' || cancelledBy === 'customer'
      return {
        title: isCancelledByCustomer ? 'لغو توسط کاربر' : 'لغو توسط ادمین',
        desc: isCancelledByCustomer
          ? doc.notes || 'سفارش توسط کاربر لغو گردید.'
          : doc.notes || 'سفارش توسط واحد بازرگانی / ادمین لغو گردید.',
      }
    })
    .otherwise(() => null)

  if (cancelConfig) {
    const steps: TimelineStep[] = [
      {
        id: 'step-1',
        title: 'سفارش ثبت شده',
        description: 'سفارش با موفقیت در سامانه ثبت گردید.',
        timestamp: formatTs(doc.createdAt) || pDate,
        status: 'completed',
      },
    ]

    if (is60MinutesPassed) {
      steps.push({
        id: 'step-2',
        title: 'در حال بررسی واحد بازرگانی',
        description: 'سفارش در صف بررسی واحد بازرگانی قرار گرفته بود.',
        timestamp: formatTs(new Date(createdAtMs + 60 * 60 * 1000).toISOString()),
        status: 'completed',
      })
    }

    steps.push({
      id: 'step-cancel',
      title: cancelConfig.title,
      description: cancelConfig.desc,
      timestamp: formatTs(doc.updatedAt) || '',
      status: 'cancelled',
    })

    return steps
  }

  // Active / Normal Flow (3 stages)
  // Stage 1: سفارش ثبت شده
  // Stage 2: در حال بررسی واحد بازرگانی (تایید پس از ۶۰ دقیقه)
  // Stage 3: تکمیل شده (صدور حواله نهایی)
  const isApproved = match(status)
    .with(P.union('completed', 'approve', 'approved'), () => true)
    .otherwise(() => false)

  const step1Status: 'completed' = 'completed'
  const step2Status = match([isApproved, is60MinutesPassed] as const)
    .with([true, P._], () => 'completed' as const)
    .with([false, true], () => 'completed' as const)
    .with([false, false], () => 'current' as const)
    .exhaustive()

  const step3Status = match([isApproved, is60MinutesPassed] as const)
    .with([true, P._], () => 'completed' as const)
    .with([false, true], () => 'current' as const)
    .with([false, false], () => 'pending' as const)
    .exhaustive()

  const step1Timestamp = formatTs(doc.createdAt) || pDate
  const step2Timestamp = (isApproved || is60MinutesPassed)
    ? formatTs(new Date(createdAtMs + 60 * 60 * 1000).toISOString())
    : undefined
  const step3Timestamp = isApproved
    ? formatTs(doc.updatedAt || doc.createdAt) || pDate
    : undefined

  return [
    {
      id: 'step-1',
      title: 'سفارش ثبت شده',
      description: 'سفارش با موفقیت در سامانه ثبت گردید.',
      timestamp: step1Timestamp,
      status: step1Status,
    },
    {
      id: 'step-2',
      title: 'در حال بررسی واحد بازرگانی',
      description: (isApproved || is60MinutesPassed)
        ? 'سفارش در دست بررسی کارشناسان واحد بازرگانی قرار گرفت.'
        : 'سفارش جهت بررسی نهایی به واحد بازرگانی ارجاع داده خواهد شد.',
      timestamp: step2Timestamp,
      status: step2Status,
    },
    {
      id: 'step-3',
      title: 'تکمیل شده',
      description: isApproved
        ? 'حواله رسمی خروج از انبار صادر گردیده و سفارش با موفقیت تکمیل شد.'
        : 'در انتظار تایید نهایی و صدور حواله رسمی توسط واحد بازرگانی.',
      timestamp: step3Timestamp,
      status: step3Status,
    },
  ]
}

export function mapDocToOrder(doc: CustomerOrderDocument): Order {
  const createdAt = doc.createdAt
  const persianDate = formatPersianDate(createdAt)
  const statusStr: string = typeof doc.status === 'string' ? doc.status : ''
  const normalizedStatus: string = statusStr === 'processing' ? 'pending' : (statusStr || 'pending')
  const cancelledByVal: string | undefined = typeof doc.cancelledBy === 'string' ? doc.cancelledBy : undefined

  const createdAtMs = new Date(createdAt).getTime()
  const is60MinutesPassed = Date.now() >= createdAtMs + 60 * 60 * 1000

  const statusLabel = match([normalizedStatus, is60MinutesPassed, cancelledByVal] as const)
    .with(['pending', true, P._], () => 'در حال بررسی واحد بازرگانی')
    .with(['pending', false, P._], () => 'سفارش ثبت شده')
    .with([P.union('completed', 'approve', 'approved'), P._, P._], () => 'تکمیل شده')
    .with(['cancelled_by_customer', P._, P._], () => 'لغو توسط کاربر')
    .with(['cancelled_by_admin', P._, P._], () => 'لغو توسط ادمین')
    .with([P.union('cancel', 'cancelled'), P._, 'customer'], () => 'لغو توسط کاربر')
    .with([P.union('cancel', 'cancelled'), P._, P._], () => 'لغو توسط ادمین')
    .otherwise(() => {
      console.warn(`[Order] Unknown order status received: ${normalizedStatus}`)
      return 'سفارش ثبت شده'
    })

  const cancelledBy: 'customer' | 'admin' | undefined = match([normalizedStatus, cancelledByVal] as const)
    .with(['cancelled_by_customer', P._], () => 'customer' as const)
    .with(['cancelled_by_admin', P._], () => 'admin' as const)
    .with([P.union('cancel', 'cancelled'), 'customer'], () => 'customer' as const)
    .with([P.union('cancel', 'cancelled'), 'admin'], () => 'admin' as const)
    .otherwise(() => undefined)

  const items: OrderItem[] = (doc.items || []).map((i) => {
    const prod = typeof i.product === 'object' && i.product !== null ? i.product : null
    const width = prod?.width
    const height = prod?.height
    const dimension = width && height ? `${width}×${height}` : ''
    const grade = prod?.grade ? formatGrade(prod.grade) : ''
    const gallery = prod?.gallery?.filter((g): g is { image: NonNullable<typeof g.image> } => g.image != null)
    const photos = catalogProductImages({ cover: prod?.cover, gallery })
    const productType = i.productType ?? prod?.productType ?? 'tile'

    return {
      productId: String(prod?.id || i.product || ''),
      productName: i.productName || prod?.name || 'قطعه',
      productSlug: prod?.slug || '',
      productSku: i.productSku || prod?.sku || '',
      productImage: photos.primary,
      productImageThumbnail: photos.thumbnailUrl,
      dimension,
      productType,
      unit: i.unit ?? (productType === 'other' ? (prod?.unit ?? 'piece') : 'm2'),
      grade,
      requestedArea: i.requestedArea,
      cartonCount: i.cartonCount,
      cartonsPerPallet: i.cartonsPerPallet ?? null,
      deliverableArea: i.deliverableArea,
      unitPrice: i.unitPrice,
      totalPrice: i.totalPrice,
    }
  })

  const timeline = buildFullOrderTimeline(doc, persianDate, is60MinutesPassed)

  const userObj = typeof doc.user === 'object' && doc.user !== null ? doc.user : null

  const orderNumber = String(doc.orderNumber || doc.id)

  return {
    id: String(doc.id),
    orderNumber,
    date: persianDate,
    createdAt,
    status: normalizedStatus as OrderStatus,
    cancelledBy,
    statusLabel,
    storeName: userObj?.companyName || '',
    customerName: userObj?.fullName ?? '',
    customerPhone: userObj?.phone || '',
    warehouseName: doc.warehouseName ?? (typeof doc.warehouse === 'object' ? doc.warehouse?.name : undefined),
    deliveryAddress: doc.deliveryAddress || userObj?.address || '',
    notes: doc.notes ?? '',
    cancellationDeadline: new Date(createdAtMs + 60 * 60 * 1000).toISOString(),
    items,
    subtotal: doc.subtotal,
    discountAmount: doc.discountAmount ?? 0,
    taxAmount: doc.taxAmount ?? 0,
    finalTotal: doc.finalTotal,
    timeline,
  }
}
