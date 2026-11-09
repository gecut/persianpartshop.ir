import { formatCartons, formatUnit } from '@/lib/utils/unit'
import { Table } from "@heroui/react"
import type { Order } from "@/modules/orders/order-types"
import { formatToman, toPersianDigits } from "@/lib/utils/currency"

interface InvoiceItemsTableProps {
  order: Order;
}

export function InvoiceItemsTable({ order }: InvoiceItemsTableProps) {
  return (
      <div className="w-full overflow-x-auto mb-4 sm:mb-5 print:overflow-visible print:mb-3">
        <Table
          aria-label="جدول اقلام پیش‌فاکتور پرشین‌پارت"
          variant="secondary"
          className="w-full min-w-[560px] sm:min-w-full table-fixed rounded-none bg-white p-0 shadow-none border-none print:w-full print:min-w-0"
        >
          <Table.Content
            aria-label="اقلام سفارش"
            className="w-full min-w-[560px] sm:min-w-full table-fixed rounded-none border-none bg-white print:w-full print:min-w-0"
          >
            <Table.Header className="bg-primary/5 text-foreground rounded-xl border-none overflow-hidden print:bg-primary/5 print:text-foreground print:rounded-xl print:border-none [&_th::after]:hidden! [&_th::after]:content-none!">
              <Table.Column
                isRowHeader
                className="w-[6%] h-10 sm:h-11 text-center px-1 text-[11px] sm:text-xs md:text-sm font-bold text-foreground! bg-primary/5! rounded-s-xl print:rounded-s-xl print:ps-2 print:text-foreground! print:bg-primary/5! border-none print:border-none after:hidden! after:content-none! print:text-[10px]"
              >
                ردیف
              </Table.Column>
              <Table.Column className="w-[35%] text-right px-2.5 py-2 text-[11px] sm:text-xs md:text-sm font-bold text-foreground! bg-primary/5! rounded-none print:text-foreground! print:bg-primary/5! border-none print:border-none after:hidden! after:content-none! print:text-[10px]">
                مشخصات
              </Table.Column>
              <Table.Column className="w-[11%] text-center px-1 py-2 text-[11px] sm:text-xs md:text-sm font-bold text-foreground! bg-primary/5! rounded-none print:text-foreground! print:bg-primary/5! border-none print:border-none after:hidden! after:content-none! print:text-[10px]">
                بسته / واحد
              </Table.Column>
              <Table.Column className="w-[11%] text-center px-1 py-2 text-[11px] sm:text-xs md:text-sm font-bold text-foreground! bg-primary/5! rounded-none print:text-foreground! print:bg-primary/5! border-none print:border-none after:hidden! after:content-none! print:text-[10px]">
                مقدار جزء
              </Table.Column>
              <Table.Column className="w-[17%] text-left px-2 py-2 text-[11px] sm:text-xs md:text-sm font-bold text-foreground! bg-primary/5! rounded-none print:text-foreground! print:bg-primary/5! border-none print:border-none after:hidden! after:content-none! print:text-[10px]">
                فی
              </Table.Column>
              <Table.Column className="w-[20%] text-left px-2 sm:px-2.5 py-2 text-[11px] sm:text-xs md:text-sm font-bold text-foreground! bg-primary/5! rounded-e-xl print:rounded-e-xl print:pe-2 print:text-foreground! print:bg-primary/5! border-none print:border-none after:hidden! after:content-none! print:text-[10px]">
                مبلغ کل
              </Table.Column>
            </Table.Header>
            <Table.Body className="bg-white rounded-none">
              {order.items.map((item, idx) => {
                const details: string[] = [];
                if (item.dimension && item.dimension !== "—") {
                  details.push(toPersianDigits(item.dimension));
                }
                if (item.grade) {
                  details.push(item.grade);
                }
                const detailStr =
                  details.length > 0 ? details.join(" ") : "";

                return (
                  <Table.Row
                    key={item.productId || idx}
                    id={item.productId || idx}
                    className="border-b border-default-200/80 print:border-none border-x-0 bg-white! hover:bg-default-50/40! rounded-none"
                  >
                    <Table.Cell className="text-center font-bold text-muted px-0.5 py-2.5 sm:py-3 text-xs sm:text-sm print:text-[10px] rounded-none border-none bg-white!">
                      {toPersianDigits(idx + 1)}
                    </Table.Cell>
                    <Table.Cell className="font-bold text-foreground px-2 py-2.5 sm:py-3 text-xs sm:text-sm print:text-[10.5px] rounded-none border-x-0 bg-white!">
                      <div className="flex flex-col gap-0.5 leading-snug">
                        <span className="text-xs sm:text-sm print:text-[10.5px] font-bold text-foreground">
                          {item.productName}
                          {detailStr ? ` ${detailStr}` : ""}
                        </span>
                        {item.productSku && (
                          <span className="text-[11px] text-muted/70 font-normal print:text-[8.5px] dir-ltr text-right inline-block">
                            کد: {item.productSku}
                          </span>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell className="text-center font-bold text-foreground px-1 py-2.5 sm:py-3 text-xs sm:text-sm print:text-[10px] whitespace-nowrap rounded-none border-x-0 bg-white!">
                      {item.productType === 'other' ? `${toPersianDigits(item.cartonCount || 1)} ${formatUnit(item.unit)}` : formatCartons(item.cartonCount || 1, item.cartonsPerPallet)}
                    </Table.Cell>
                    <Table.Cell className="text-center font-bold text-foreground px-1 py-2.5 sm:py-3 text-xs sm:text-sm print:text-[10px] whitespace-nowrap rounded-none border-x-0 bg-white!">
                      {toPersianDigits(
                        item.deliverableArea || item.requestedArea || 1,
                      )}{" "}
                      {item.productType === 'other' ? formatUnit(item.unit) : 'مترمربع'}
                    </Table.Cell>
                    <Table.Cell className="text-left font-bold text-foreground px-1.5 sm:px-2 py-2.5 sm:py-3 text-xs sm:text-sm print:text-[10.5px] whitespace-nowrap leading-none rounded-none border-x-0 bg-white!">
                      {formatToman(item.unitPrice)}
                    </Table.Cell>
                    <Table.Cell className="text-left font-black text-foreground px-2 sm:px-2.5 py-2.5 sm:py-3 text-xs sm:text-sm print:text-[10.5px] whitespace-nowrap leading-none rounded-none border-x-0 bg-white!">
                      {formatToman(item.totalPrice)}
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Content>
        </Table>
      </div>
  );
}
