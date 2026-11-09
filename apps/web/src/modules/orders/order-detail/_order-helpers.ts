import { formatTrackingNumber } from '@/lib/utils/tracking-number'

export function formatInvoiceNumber(order: { id: string | number; orderNumber?: string } | string | number): string {
  return formatTrackingNumber(typeof order === 'object' ? order.orderNumber || order.id : order)
}

export const CANCELLATION_REASONS = [
  "تغییر در متراژ یا اقلام سفارش",
  "تغییر در زمان‌بندی پروژه",
  "ثبت اشتباه فاکتور",
  "انصراف موقت خریدار",
] as const;
