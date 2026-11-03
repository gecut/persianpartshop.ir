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
          <div className="min-h-full w-full flex flex-col items-center justify-start p-2 sm:p-4 md:p-6 pb-12 sm:pb-16 print:p-0">
            {/* Action Bar (Squircle on screen, hidden in print) */}
            <div className="w-full max-w-4xl bg-surface rounded-2xl p-3 mb-4 shadow-xl flex items-center justify-between gap-3 no-print sticky top-2 z-10 box-border">
              <div className="flex items-center gap-2 min-w-0">
                <Button
                  type="button"
                  onPress={onClose}
                  aria-label="بازگشت"
                  className="h-10 px-3.5 rounded-xl bg-muted/10 hover:bg-muted/15 text-foreground text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
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

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onPress={handlePrint}
                  className="h-10 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                >
                  <PrinterIcon size={18} />
                  <span>چاپ / ذخیره PDF (قطع A5)</span>
                </Button>

                <Button
                  type="button"
                  onPress={onClose}
                  aria-label="بستن"
                  className="size-10 rounded-xl bg-muted/10 hover:bg-muted/20 text-muted hover:text-foreground flex items-center justify-center cursor-pointer transition-colors"
                >
                  <XIcon size={18} />
                </Button>
              </div>
            </div>

            {/* Printable Invoice Sheet (Squircle rounded-3xl on screen, crisp rectangular on print) */}
            <div
              id="printable-invoice"
              className="w-full max-w-4xl bg-white text-neutral-900 rounded-3xl shadow-2xl p-3 sm:p-8 md:p-10 border-none print:rounded-none print:shadow-none print:p-0 print:m-0 print:w-full print:max-w-none text-right font-sans select-text box-border"
              dir="rtl"
            >
              <div className="print:pb-3 print:mb-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:flex-row print:items-center print:gap-3">
                  <div className="flex items-center gap-3 print:gap-2.5">
                    <div className="size-11 rounded-2xl overflow-hidden flex items-center justify-center shrink-0 print:size-8 print:rounded-xl">
                      <img
                        src="https://cdn.persianpartshop.ir/assets/images/logo/persianpartshop-logo.png"
                        alt="لوگو"
                        className="size-full object-contain rounded-2xl print:rounded-xl"
                      />
                    </div>
                    <div>
                      <h1 className="text-base sm:text-lg font-black text-neutral-900 tracking-tight whitespace-nowrap print:text-sm">
                        بازرگانی کاشی و سرامیک پرشین‌پارت
                      </h1>
                    </div>
                  </div>

                  <div className="w-full sm:w-auto bg-neutral-100/60 rounded-2xl p-3 min-w-52 text-xs space-y-1.5 print:p-2 print:space-y-1 print:text-[9px] print:min-w-0 print:rounded-xl">
                    <div className="flex items-center justify-between gap-3 whitespace-nowrap print:gap-2">
                      <span className="text-neutral-500 font-semibold">
                        نوع سند:
                      </span>
                      <span className="font-extrabold text-neutral-900">
                        پیش‌فاکتور رسمی فروش
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 whitespace-nowrap print:gap-2">
                      <span className="text-neutral-500 font-semibold">
                        شماره فاکتور:
                      </span>
                      <span className="font-bold text-neutral-900 dir-ltr ">
                        {formattedInvoiceNumber}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 whitespace-nowrap print:gap-2">
                      <span className="text-neutral-500 font-semibold">
                        تاریخ صدور:
                      </span>
                      <span className="font-bold text-neutral-900">
                        {formatPersianDate(order.createdAt || order.date)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 whitespace-nowrap print:gap-2">
                      <span className="text-neutral-500 font-semibold">
                        اعتبار پیش‌فاکتور:
                      </span>
                      <span className="font-semibold text-neutral-800">
                        ۷۲ ساعت کاری
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex w-full">
                <div className="p-3.5 sm:p-4 w-full rounded-2xl space-y-2.5 text-xs print:p-2.5 print:space-y-1 print:text-[8.5px] print:rounded-xl">
                  <div className="flex items-center gap-1.5 pb-1 font-extrabold text-neutral-900 text-xs sm:text-sm print:text-[9px]">
                    <FileTextIcon
                      size={15}
                      className="print:size-3 text-neutral-600"
                    />
                    <span>مشخصات خریدار (مشتری)</span>
                  </div>
                  <div className="space-y-1.5 text-neutral-700 leading-normal print:space-y-0.5">
                    <div className="flex items-center justify-between gap-2 whitespace-nowrap">
                      <span className="text-neutral-500">
                        خریدار / نماینده:
                      </span>
                      <strong className="text-neutral-900 font-bold">
                        {order.customerName || "خریدار محترم"}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between gap-2 whitespace-nowrap">
                      <span className="text-neutral-500">شماره همراه:</span>
                      <span className=" text-neutral-900" dir="ltr">
                        {order.customerPhone || "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 whitespace-nowrap">
                      <span className="text-neutral-500">فروشگاه / شرکت:</span>
                      <strong className="text-neutral-900">
                        {order.storeName || "—"}
                      </strong>
                    </div>
                    <div className="flex items-baseline justify-between gap-2 pt-0.5">
                      <span className="text-neutral-500 shrink-0 whitespace-nowrap">
                        نشانی تحویل:
                      </span>
                      <span className="text-neutral-800 text-left text-[11px] sm:text-xs print:text-[8px]">
                        {order.deliveryAddress || "انبار مرکزی / پروژه"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-full max-w-full overflow-hidden mb-5 print:mb-3">
                <Table
                  variant="secondary"
                  aria-label="جدول اقلام پیش‌فاکتور پرشین‌پارت"
                  className="w-full max-w-full table-fixed border-none shadow-none p-0 overflow-hidden"
                >
                  <Table.Content
                    aria-label="اقلام سفارش"
                    className="w-full table-fixed border-none"
                  >
                    <Table.Header>
                      <Table.Column
                        isRowHeader
                        className="w-[8%] h-11 text-center px-1 text-[9px] sm:text-xs font-bold text-neutral-700 print:text-[8.5px]"
                      >
                        ردیف
                      </Table.Column>
                      <Table.Column className="w-[42%] text-right px-2 py-2 text-[9.5px] sm:text-xs font-bold text-neutral-700 print:text-[8.5px]">
                        شرح کالا / ابعاد / درجه
                      </Table.Column>
                      <Table.Column className="w-[12%] text-center px-1 py-2 text-[9px] sm:text-xs font-bold text-neutral-700 print:text-[8.5px]">
                        تعداد کارتن
                      </Table.Column>
                      <Table.Column className="w-[12%] text-center px-1 py-2 text-[9px] sm:text-xs font-bold text-neutral-700 print:text-[8.5px]">
                        مقدار جزء
                      </Table.Column>
                      <Table.Column className="w-[13%] text-left px-1 py-2 text-[9px] sm:text-xs font-bold text-neutral-700 print:text-[8.5px]">
                        فی
                      </Table.Column>
                      <Table.Column className="w-[13%] text-left px-2 py-2 text-[9px] sm:text-xs font-bold text-neutral-700 print:text-[8.5px]">
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
                            <Table.Cell className="text-center font-bold text-neutral-500 px-0.5 py-3 text-xs sm:text-xs print:text-[8.5px]">
                              {toPersianDigits(idx + 1)}
                            </Table.Cell>
                            <Table.Cell className="font-bold text-neutral-900 px-2 py-3 text-[9.5px] sm:text-xs print:text-[8.5px]">
                              <div className="flex flex-col gap-0.5 leading-snug">
                                <span>
                                  {item.productName}
                                  {detailStr ? ` ${detailStr}` : ""}
                                </span>
                                {item.productSku && (
                                  <span className="text-[10px] text-neutral-400 font-normal print:text-[7.5px] dir-ltr text-right inline-block">
                                    کد: {item.productSku}
                                  </span>
                                )}
                              </div>
                            </Table.Cell>
                            <Table.Cell className="text-center font-bold text-neutral-900 px-1 py-3 text-[9.5px] sm:text-xs print:text-[8.5px] whitespace-nowrap">
                              {toPersianDigits(item.cartonCount || 1)} کارتن
                            </Table.Cell>
                            <Table.Cell className="text-center font-bold text-neutral-900 px-1 py-3 text-[9.5px] sm:text-xs print:text-[8.5px] whitespace-nowrap">
                              {toPersianDigits(
                                item.deliverableArea || item.requestedArea || 1,
                              )}{" "}
                              متر
                            </Table.Cell>
                            <Table.Cell className="text-left font-semibold text-neutral-800 px-1 py-3 text-[9px] sm:text-[11px] print:text-[8px] whitespace-nowrap leading-tight">
                              {formatToman(item.unitPrice)}
                            </Table.Cell>
                            <Table.Cell className="text-left font-extrabold text-neutral-900 px-2 py-3 text-[9.5px] sm:text-xs print:text-[8.5px] whitespace-nowrap leading-tight">
                              {formatToman(item.totalPrice)}
                            </Table.Cell>
                          </Table.Row>
                        );
                      })}
                    </Table.Body>
                  </Table.Content>
                  <Table.Footer className="border-none p-0">
                    <div className="flex items-center justify-between p-2.5 sm:p-3 font-extrabold text-neutral-900 text-[11px] sm:text-xs whitespace-nowrap print:p-1.5 print:text-[8.5px]">
                      <div>
                        جمع کل: {toPersianDigits(totalCartons)} کارتن
                        {totalArea > 0 &&
                          ` (${toPersianDigits(totalArea)} متر)`}
                      </div>
                    </div>
                  </Table.Footer>
                </Table>
              </div>


              {/* 4. Financial Totals & 1% Application Discount Notice (بدون بوردر) */}
              <div className="w-full flex flex-col gap-4">
                <div className="w-full flex items-center">
                  <div className="md:col-span-7 space-y-3.5 print:col-span-7 print:space-y-2">
                    {/* بخش ویژه تخفیف اپلیکیشن طبق درخواست کاربر */}
                    <div className=" rounded-2xl p-3.5 sm:p-4 text-emerald-950 space-y-1.5 print:p-2 print:space-y-1 print:rounded-xl">
                      <div className="flex items-center gap-1.5 font-black text-xs sm:text-sm text-emerald-950 print:text-[9px]">
                        <span>
                          تخفیف ویژه ۱٪ در صورت استفاده از اپلیکیشن پرشین‌پارت
                        </span>
                      </div>
                    </div>

                    {/* شرایط عمومی پیش‌فاکتور */}
                  </div>
                </div>
                {/* Left Side: Summary Table (۵ ستون - بدون بوردر) */}
                <div className="md:col-span-5 bg-neutral-100/50 rounded-2xl text-xs overflow-hidden print:col-span-5 print:text-[9px] print:rounded-xl">
                  <div className="p-3 bg-neutral-200/60 font-extrabold text-neutral-900 text-xs sm:text-sm print:p-2 print:text-[9px]">
                    خلاصه صورت‌حساب مالی
                  </div>
                  <div className="p-3 sm:p-3.5 space-y-2.5 print:p-2 print:space-y-1.5">
                    <div className="flex items-center justify-between text-neutral-700 whitespace-nowrap">
                      <span>جمع ناخالص کالاها:</span>
                      <span className="font-bold">
                        {formatToman(subtotal)} 
                      </span>
                    </div>

                    {discountAmount > 0 && (
                      <div className="flex items-center justify-between text-rose-700 pt-0.5 whitespace-nowrap">
                        <span>تخفیف همکار / فاکتور:</span>
                        <span className="font-bold">
                          - {formatToman(discountAmount)} 
                        </span>
                      </div>
                    )}

                    {taxAmount > 0 && (
                      <div className="flex items-center justify-between text-neutral-700 pt-0.5 whitespace-nowrap">
                        <span>مالیات ارزش افزوده (۱۰٪):</span>
                        <span className="font-bold">
                          {formatToman(taxAmount)} 
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-neutral-900 pt-0.5 font-bold whitespace-nowrap">
                      <span>مبلغ کل فاکتور:</span>
                      <span>{formatToman(finalTotal)} </span>
                    </div>

                    {/* ردیف تخفیف ۱٪ اپلیکیشن */}
                    <div className="flex items-center justify-between text-emerald-800 bg-emerald-100/70 p-2.5 rounded-xl font-bold pt-2 whitespace-nowrap print:rounded-lg">
                      <span>تخفیف ویژه اپلیکیشن (۱٪):</span>
                      <span className="font-black dir-ltr text-emerald-900">
                        - {formatToman(appDiscount)} 
                      </span>
                    </div>

                    {/* مبلغ نهایی قابل پرداخت با اپلیکیشن */}
                    <div className="flex items-center justify-between bg-neutral-900 text-background p-3 rounded-xl font-bold text-xs sm:text-sm py-3 whitespace-nowrap print:p-2 print:rounded-lg print:text-[9px]">
                      <span>مبلغ نهایی با اپلیکیشن:</span>
                      <span className="text-xs sm:text-sm">
                        {formatToman(finalWithAppDiscount)} تومان
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-3  rounded-2xl text-[11px] sm:text-xs text-neutral-600 space-y-1 leading-normal print:p-2 print:text-[8px] print:space-y-0.5 print:rounded-xl">
                <span className="font-bold text-neutral-800 block">
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
                  <p className="pt-0.5 text-neutral-800">
                    <strong>توضیحات سفارش:</strong> {order.notes}
                  </p>
                )}
              </div>

              {/* 5. Signatures and Seals (مهر و امضا رسمی - بدون بوردر) */}
              <div className="pt-6 mt-6 print:pt-4 print:mt-4">
                <div className="grid grid-cols-2 gap-6 text-center text-xs print:gap-4 print:text-[8.5px]">
                  <div className="space-y-10 print:space-y-6">
                    <span className="font-extrabold text-neutral-800 block">
                      مهر و امضای امور مالی و فروش پرشین‌پارت
                    </span>
                    <div className="text-[10px] text-neutral-400  print:text-[7.5px]">
                      PersianPart Financial Dep. Stamp
                    </div>
                  </div>

                  <div className="space-y-10 print:space-y-6">
                    <span className="font-extrabold text-neutral-800 block">
                      امضا و تایید تحویل‌گیرنده / خریدار
                    </span>
                    <div className="text-[10px] text-neutral-400  print:text-[7.5px]">
                      Customer Signature & Date
                    </div>
                  </div>
                </div>
              </div>

              {/* Print Footer */}
              <div className="text-center text-[10px] text-neutral-400 mt-6 pt-3 print:block print:mt-2 print:pt-1 print:text-[7.5px]">
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
