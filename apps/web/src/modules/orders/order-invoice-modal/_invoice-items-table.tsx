import { formatToman, toPersianDigits } from '@/lib/utils/currency'
import { formatCartons, formatUnit } from '@/lib/utils/unit'
import type { Order } from '@/modules/orders/order-types'
import { formatInvoiceQuantity } from './_invoice-format'

interface InvoiceItemsTableProps {
  order: Order
}

export function InvoiceItemsTable({ order }: InvoiceItemsTableProps) {
  return (
    <div className="w-full overflow-x-auto mb-4 sm:mb-5 print:overflow-visible print:mb-3">
      <table className="w-full min-w-[560px] sm:min-w-0 print:min-w-0 table-fixed border-collapse text-xs print:text-[9.5px]">
        <caption className="sr-only">اقلام پیش‌فاکتور</caption>
        <thead>
          <tr className="bg-default-100 text-foreground">
            <th scope="col" className="w-[6%] py-2.5 px-1 text-center font-bold">
              ردیف
            </th>
            <th scope="col" className="w-[38%] py-2.5 px-2.5 text-start font-bold">
              شرح کالا
            </th>
            <th scope="col" className="w-[13%] py-2.5 px-1 text-center font-bold">
              تعداد بسته
            </th>
            <th scope="col" className="w-[13%] py-2.5 px-1 text-center font-bold">
              مقدار
            </th>
            <th scope="col" className="w-[14%] py-2.5 px-2 text-end font-bold">
              فی (تومان)
            </th>
            <th scope="col" className="w-[16%] py-2.5 px-2 text-end font-bold">
              مبلغ (تومان)
            </th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, idx) => {
            const hasDimension = Boolean(item.dimension && item.dimension !== '—')

            const packageLabel =
              item.productType === 'other'
                ? `${toPersianDigits(item.cartonCount)} ${formatUnit(item.unit)}`
                : formatCartons(item.cartonCount, item.cartonsPerPallet)

            const quantityLabel = `${formatInvoiceQuantity(item.deliverableArea)} ${
              item.productType === 'other' ? formatUnit(item.unit) : 'مترمربع'
            }`

            return (
              <tr key={`${item.productId}-${idx}`} className="border-b border-default-200 break-inside-avoid">
                <td className="py-2.5 px-1 text-center font-bold text-muted">
                  {toPersianDigits(idx + 1)}
                </td>
                <th scope="row" className="py-2.5 px-2 text-start font-bold text-foreground break-words">
                  <div className="flex flex-col gap-0.5 leading-snug">
                    <span>
                      {item.productName}
                      {hasDimension && (
                        <>
                          {' '}
                          <bdi dir="ltr">{toPersianDigits(item.dimension)}</bdi>
                        </>
                      )}
                      {item.grade ? ` ${item.grade}` : ''}
                    </span>
                    {item.productSku && (
                      <span className="text-[11px] text-muted/70 font-normal print:text-[8.5px]">
                        کد: <bdi dir="ltr">{item.productSku}</bdi>
                      </span>
                    )}
                  </div>
                </th>
                <td className="py-2.5 px-1 text-center font-bold text-foreground">
                  {packageLabel}
                </td>
                <td className="py-2.5 px-1 text-center font-bold text-foreground">
                  {quantityLabel}
                </td>
                <td className="py-2.5 px-2 text-end font-bold text-foreground whitespace-nowrap">
                  {formatToman(item.unitPrice)}
                </td>
                <td className="py-2.5 px-2 text-end font-black text-foreground whitespace-nowrap">
                  {formatToman(item.totalPrice)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
