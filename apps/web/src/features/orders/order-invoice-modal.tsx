import { useMemo } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Button, Table } from "@heroui/react";
import type { Order } from "../../types";
import { formatToman, toPersianDigits } from "../../lib/utils/currency";
import { formatPersianDate } from "../../lib/utils/date";
import {
  PrinterIcon,
  XIcon,
  ArrowRightIcon,
  FileTextIcon,
} from "../../components/ui/icons";

export interface OrderInvoiceModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
}

export function OrderInvoiceModal({
  order,
  isOpen,
  onClose,
}: OrderInvoiceModalProps) {
  if (!order) return null;

  // Financial calculations
  const subtotal = order.subtotal || 0;
  const discountAmount = order.discountAmount || 0;
  const taxAmount = order.taxAmount || 0;
  const finalTotal = order.finalTotal || subtotal;

  // 1% Application Discount calculation (e.g. 200,000,000 -> 2,000,000 discount -> 198,000,000 final)
  const appDiscountRate = 0.01;
  const appDiscount = Math.round(finalTotal * appDiscountRate);
  const finalWithAppDiscount = Math.max(0, finalTotal - appDiscount);

  // Total cartons & sqm
  const totalCartons = useMemo(() => {
    return (order.items || []).reduce(
      (acc, i) => acc + (i.cartonCount || 0),
      0,
    );
  }, [order.items]);

  const totalArea = useMemo(() => {
    const sum = (order.items || []).reduce(
      (acc, i) => acc + (i.deliverableArea || i.requestedArea || 0),
      0,
    );
    return Math.round(sum * 100) / 100;
  }, [order.items]);

  const formattedInvoiceNumber = useMemo(() => {
    if (order.orderNumber && /^ptp\s+/i.test(order.orderNumber)) {
      return order.orderNumber.toLowerCase();
    }
    const cleanId = String(order.id)
      .replace(/^ord-/, "")
      .replace(/^ptp\s*/i, "");
    return `ptp ${cleanId}`;
  }, [order.id, order.orderNumber]);

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = `پیش‌فاکتور_${formattedInvoiceNumber.replace(/\s+/g, "_")}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id="order-invoice-portal"
          key="invoice-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs overflow-y-auto overscroll-contain print:static print:p-0 print:bg-white print:overflow-visible print:z-auto print:block print:w-full print:m-0"
        >
          <div className="min-h-full w-full flex flex-col items-center justify-start p-1.5 sm:p-4 md:p-6 pb-12 sm:pb-16 print:p-0 print:block print:w-full print:m-0">
            {/* Action Bar (Squircle on screen, hidden in print) */}
            <div className="w-full max-w-4xl bg-surface rounded-2xl p-2.5 sm:p-3 mb-3 sm:mb-4 shadow-xl flex items-center justify-between gap-2 sm:gap-3 no-print sticky top-2 z-10 box-border">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <Button
                  type="button"
                  onPress={onClose}
                  aria-label="بازگشت"
                  className="h-9 sm:h-10 px-2.5 sm:px-3.5 rounded-xl bg-muted/10 hover:bg-muted/15 text-foreground text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <ArrowRightIcon size={16} />
                  <span>بازگشت</span>
                </Button>
                <div className="hidden sm:flex flex-col">
                  <span className="text-xs font-extrabold text-foreground">
                    پیش‌فاکتور رسمی سفارش
                  </span>
                  <span className="text-[11px] text-muted dir-ltr ">
                    {formattedInvoiceNumber}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2">
                <Button
                  type="button"
                  onPress={handlePrint}
                  className="h-9 sm:h-10 px-3 sm:px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                >
                  <PrinterIcon size={16} />
                  <span>چاپ / ذخیره PDF</span>
                </Button>

                <Button
                  type="button"
                  onPress={onClose}
                  aria-label="بستن"
                  className="size-9 sm:size-10 rounded-xl bg-muted/10 hover:bg-muted/20 text-muted hover:text-foreground flex items-center justify-center cursor-pointer transition-colors"
                >
                  <XIcon size={16} />
                </Button>
              </div>
            </div>

            {/* Printable Invoice Sheet (Squircle rounded-3xl on screen, crisp rectangular on print) */}
            <div
              id="printable-invoice"
              className="w-full max-w-4xl bg-surface text-foreground rounded-2xl sm:rounded-3xl shadow-2xl p-3 sm:p-8 md:p-10 border-none print:rounded-none print:shadow-none print:p-0 print:m-0 print:w-full print:max-w-none text-right font-sans select-text box-border mx-auto"
              dir="rtl"
            >
              <div className="print:pb-3 print:mb-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 print:flex-row print:items-center print:gap-3">
                  <div className="flex items-center gap-2.5 sm:gap-3 print:gap-2.5">
                    <div className="size-10 sm:size-11 rounded-xl sm:rounded-2xl overflow-hidden flex items-center justify-center shrink-0 print:size-8 print:rounded-xl">
                      <img
                        src="/assets/images/persian-part-logo.png"
                        alt="پرشین‌پارت"
                        className="size-full object-contain rounded-xl sm:rounded-2xl print:rounded-xl"
                      />
                    </div>
                    <div>
                      <h1 className="text-sm sm:text-lg font-black text-foreground tracking-tight whitespace-nowrap print:text-sm">
                        بازرگانی کاشی و سرامیک پرشین‌پارت
                      </h1>
                    </div>
                  </div>

                  <div className="w-full sm:w-auto bg-default-100 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 min-w-0 sm:min-w-52 text-[11px] sm:text-xs space-y-1 sm:space-y-1.5 print:p-2 print:space-y-1 print:text-[9px] print:rounded-xl">
                    <div className="flex items-center justify-between gap-3 whitespace-nowrap print:gap-2">
                      <span className="text-muted font-semibold">
                        نوع سند:
                      </span>
                      <span className="font-extrabold text-foreground">
                        پیش‌فاکتور رسمی فروش
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 whitespace-nowrap print:gap-2">
                      <span className="text-muted font-semibold">
                        شماره فاکتور:
                      </span>
                      <span className="font-bold text-foreground dir-ltr ">
                        {formattedInvoiceNumber}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 whitespace-nowrap print:gap-2">
                      <span className="text-muted font-semibold">
                        تاریخ صدور:
                      </span>
                      <span className="font-bold text-foreground">
                        {formatPersianDate(order.createdAt || order.date)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 whitespace-nowrap print:gap-2">
                      <span className="text-muted font-semibold">
                        اعتبار پیش‌فاکتور:
                      </span>
                      <span className="font-semibold text-foreground/80">
                        ۷۲ ساعت کاری
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex w-full mb-3 sm:mb-4">
                <div className="p-3 sm:p-4 w-full bg-default-100 rounded-xl sm:rounded-2xl space-y-2 sm:space-y-2.5 text-[11px] sm:text-xs print:p-2.5 print:space-y-1 print:text-[8.5px] print:rounded-xl">
                  <div className="flex items-center gap-1.5 pb-0.5 sm:pb-1 font-extrabold text-foreground text-xs sm:text-sm print:text-[9px]">
                    <FileTextIcon
                      size={14}
                      className="print:size-3 text-muted"
                    />
                    <span>مشخصات خریدار (مشتری)</span>
                  </div>
                  <div className="space-y-1 sm:space-y-1.5 text-foreground/80 leading-normal print:space-y-0.5">
                    <div className="flex items-center justify-between gap-2 whitespace-nowrap">
                      <span className="text-muted">
                        خریدار / نماینده:
                      </span>
                      <strong className="text-foreground font-bold">
                        {order.customerName || "خریدار محترم"}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between gap-2 whitespace-nowrap">
                      <span className="text-muted">شماره همراه:</span>
                      <span className=" text-foreground font-semibold" dir="ltr">
                        {order.customerPhone || "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 whitespace-nowrap">
                      <span className="text-muted">فروشگاه / شرکت:</span>
                      <strong className="text-foreground">
                        {order.storeName || "—"}
                      </strong>
                    </div>
                    <div className="flex items-baseline justify-between gap-2 pt-0.5">
                      <span className="text-muted shrink-0 whitespace-nowrap">
                        نشانی تحویل:
                      </span>
                      <span className="text-foreground/80 text-left text-[11px] sm:text-xs print:text-[8px]">
                        {order.deliveryAddress || "انبار مرکزی / پروژه"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Table with horizontal scroll on mobile */}
              <div className="w-full max-w-full overflow-x-auto -mx-1 px-1 mb-4 sm:mb-5 print:overflow-visible print:mx-0 print:px-0 print:mb-3">
                <Table
                  aria-label="جدول اقلام پیش‌فاکتور پرشین‌پارت"
                  className="w-full min-w-[520px] sm:min-w-full table-fixed border-none shadow-none p-0 print:min-w-0"
                >
                  <Table.Content
                    aria-label="اقلام سفارش"
                    className="w-full table-fixed border-none"
                  >
                    <Table.Header className="bg-black text-white rounded-xl overflow-hidden">
                      <Table.Column
                        isRowHeader
                        className="w-[8%] h-10 sm:h-11 text-center px-1 text-[9px] sm:text-xs font-bold text-white! bg-black! print:text-[8.5px]"
                      >
                        ردیف
                      </Table.Column>
                      <Table.Column className="w-[42%] text-right px-2 py-2 text-[9px] sm:text-xs font-bold text-white! bg-black! print:text-[8.5px]">
                        شرح کالا / ابعاد / درجه
                      </Table.Column>
                      <Table.Column className="w-[12%] text-center px-1 py-2 text-[9px] sm:text-xs font-bold text-white! bg-black! print:text-[8.5px]">
                        تعداد کارتن
                      </Table.Column>
                      <Table.Column className="w-[12%] text-center px-1 py-2 text-[9px] sm:text-xs font-bold text-white! bg-black! print:text-[8.5px]">
                        مقدار جزء
                      </Table.Column>
                      <Table.Column className="w-[13%] text-left px-1 py-2 text-[9px] sm:text-xs font-bold text-white! bg-black! print:text-[8.5px]">
                        فی
                      </Table.Column>
                      <Table.Column className="w-[13%] text-left px-2 py-2 text-[9px] sm:text-xs font-bold text-white! bg-black! print:text-[8.5px]">
                        مبلغ کل
                      </Table.Column>
                    </Table.Header>
                    <Table.Body>
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
                            className="border-none bg-background! hover:bg-background!"
                          >
                            <Table.Cell className="text-center font-bold text-muted px-0.5 py-2.5 sm:py-3 text-xs print:text-[8.5px]">
                              {toPersianDigits(idx + 1)}
                            </Table.Cell>
                            <Table.Cell className="font-bold text-foreground px-2 py-2.5 sm:py-3 text-[9.5px] sm:text-xs print:text-[8.5px]">
                              <div className="flex flex-col gap-0.5 leading-snug">
                                <span>
                                  {item.productName}
                                  {detailStr ? ` ${detailStr}` : ""}
                                </span>
                                {item.productSku && (
                                  <span className="text-[10px] text-muted/70 font-normal print:text-[7.5px] dir-ltr text-right inline-block">
                                    کد: {item.productSku}
                                  </span>
                                )}
                              </div>
                            </Table.Cell>
                            <Table.Cell className="text-center font-bold text-foreground px-1 py-2.5 sm:py-3 text-[9.5px] sm:text-xs print:text-[8.5px] whitespace-nowrap">
                              {toPersianDigits(item.cartonCount || 1)} کارتن
                            </Table.Cell>
                            <Table.Cell className="text-center font-bold text-foreground px-1 py-2.5 sm:py-3 text-[9.5px] sm:text-xs print:text-[8.5px] whitespace-nowrap">
                              {toPersianDigits(
                                item.deliverableArea || item.requestedArea || 1,
                              )}{" "}
                              متر
                            </Table.Cell>
                            <Table.Cell className="text-left font-semibold text-foreground/80 px-1 py-2.5 sm:py-3 text-[9px] sm:text-[11px] print:text-[8px] whitespace-nowrap leading-tight">
                              {formatToman(item.unitPrice)}
                            </Table.Cell>
                            <Table.Cell className="text-left font-extrabold text-foreground px-2 py-2.5 sm:py-3 text-[9.5px] sm:text-xs print:text-[8.5px] whitespace-nowrap leading-tight">
                              {formatToman(item.totalPrice)}
                            </Table.Cell>
                          </Table.Row>
                        );
                      })}
                    </Table.Body>
                  </Table.Content>
                  <Table.Footer className="border-none p-0">
                    <div className="flex mt-2 items-center justify-between p-2.5 sm:p-3 font-extrabold text-foreground text-[11px] sm:text-xs whitespace-nowrap print:p-1.5 print:text-[8.5px]">
                      <div>
                        جمع کل: {toPersianDigits(totalCartons)} کارتن
                        {totalArea > 0 &&
                          ` (${toPersianDigits(totalArea)} متر)`}
                      </div>
                    </div>
                  </Table.Footer>
                </Table>
              </div>

              {/* 4. Financial Totals (بدون باکس خالی اضافی) */}
              <div className="w-full flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-5">
                <div className="w-full bg-default-100 rounded-xl sm:rounded-2xl text-xs overflow-hidden print:text-[9px] print:rounded-xl">
                  <div className="p-2.5 sm:p-3 bg-default-200 font-extrabold text-foreground text-xs sm:text-sm print:p-2 print:text-[9px]">
                    خلاصه صورت‌حساب مالی
                  </div>
                  <div className="p-3 sm:p-3.5 space-y-2 sm:space-y-2.5 print:p-2 print:space-y-1.5">
                    <div className="flex items-center justify-between text-foreground/80 whitespace-nowrap">
                      <span>جمع ناخالص کالاها:</span>
                      <span className="font-bold">
                        {formatToman(subtotal)} تومان
                      </span>
                    </div>

                    {discountAmount > 0 && (
                      <div className="flex items-center justify-between text-danger pt-0.5 whitespace-nowrap font-bold">
                        <span>تخفیف همکار / فاکتور:</span>
                        <span>
                          - {formatToman(discountAmount)} تومان
                        </span>
                      </div>
                    )}

                    {taxAmount > 0 && (
                      <div className="flex items-center justify-between text-foreground/80 pt-0.5 whitespace-nowrap">
                        <span>مالیات ارزش افزوده (۱۰٪):</span>
                        <span className="font-bold">
                          {formatToman(taxAmount)} تومان
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-foreground pt-0.5 font-bold whitespace-nowrap">
                      <span>مبلغ کل فاکتور:</span>
                      <span>{formatToman(finalTotal)} تومان</span>
                    </div>

                    {/* ردیف تخفیف ۱٪ اپلیکیشن */}
                    <div className="flex items-center justify-between bg-emerald-100/90 dark:bg-emerald-950/60 border border-emerald-400 text-emerald-950 dark:text-emerald-100 p-2 sm:p-2.5 rounded-lg sm:rounded-xl font-bold pt-2 whitespace-nowrap print:rounded-lg print:bg-emerald-200 print:border-emerald-400">
                      <span>تخفیف ویژه اپلیکیشن (۱٪):</span>
                      <span className="font-black dir-ltr text-emerald-950 dark:text-emerald-100">
                        - {formatToman(appDiscount)} تومان
                      </span>
                    </div>

                    {/* مبلغ نهایی قابل پرداخت با اپلیکیشن */}
                    <div className="flex items-center justify-between bg-foreground text-background p-2.5 sm:p-3 rounded-lg sm:rounded-xl font-bold text-xs sm:text-sm py-2.5 sm:py-3 whitespace-nowrap print:p-2 print:rounded-lg print:text-[9px]">
                      <span>مبلغ نهایی با اپلیکیشن:</span>
                      <span className="text-xs sm:text-sm">
                        {formatToman(finalWithAppDiscount)} تومان
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* شرایط و ضوابط رسمی */}
              <div className="p-3 bg-default-100 rounded-2xl text-[11px] sm:text-xs text-foreground/80 space-y-1 leading-normal print:p-2 print:text-[8px] print:space-y-0.5 print:rounded-xl">
                <span className="font-bold text-foreground block">
                  شرایط و ضوابط رسمی:
                </span>
                <p>
                  • بارگیری و تحویل کالا از انبار مرکزی با ارائه تاییدیه مالی
                  حواله رسمی معتبر خواهد بود.
                </p>
                <p>
                  • تغییرات احتمالی متراژ و هزینه حمل تا مقصد به عهده خریدار
                  محترم می‌باشد.
                </p>
                {order.notes && (
                  <p className="pt-0.5 text-foreground font-semibold">
                    <strong>توضیحات سفارش:</strong> {order.notes}
                  </p>
                )}
              </div>

              {/* 5. Signatures and Seals */}
              <div className="pt-6 mt-6 print:pt-4 print:mt-4">
                <div className="grid grid-cols-2 gap-6 text-center text-xs print:gap-4 print:text-[8.5px]">
                  <div className="space-y-10 print:space-y-6">
                    <span className="font-extrabold text-foreground block">
                      مهر و امضای امور مالی و فروش پرشین‌پارت
                    </span>
                    <div className="text-[10px] text-muted/70 print:text-[7.5px]">
                      PersianPart Financial Dep. Stamp
                    </div>
                  </div>

                  <div className="space-y-10 print:space-y-6">
                    <span className="font-extrabold text-foreground block">
                      امضا و تایید تحویل‌گیرنده / خریدار
                    </span>
                    <div className="text-[10px] text-muted/70 print:text-[7.5px]">
                      Customer Signature & Date
                    </div>
                  </div>
                </div>
              </div>

              {/* Print Footer */}
              <div className="text-center text-[10px] text-muted/70 mt-6 pt-3 print:block print:mt-2 print:pt-1 print:text-[7.5px]">
                این پیش‌فاکتور توسط سامانه مکانیزه پرشین‌پارت صادر شده و ارزش
                قانونی جهت بارگیری کالا دارد.
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
