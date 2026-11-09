import { useNavigate } from "@tanstack/react-router"
import { Drawer, Button } from "@heroui/react"
import type { Plan } from "@/modules/plans/plan-types"
import type { Product } from "@/modules/products/product-types"
import { toPersianDigits } from "@/lib/utils/currency"
import { formatPersianDate } from "@/lib/utils/date"
import { BoxIcon, ArrowLeftIcon, ClockIcon, XIcon, TagIcon } from "@/components/ui/icons"
import { toast } from "@/components/feedback/toast"
import { selectionStore } from "@/modules/products/selection-store"
import { PlanProductRow } from "./_plan-product-row"

interface PlanConditionsSheetProps {
  plan: Plan;
  planProducts: Product[];
  isOpen: boolean;
  onClose: () => void;
  isExpired: boolean;
  isUpcoming: boolean;
  isActive: boolean;
  upcomingDaysText: string;
  isOrderingDisabled: boolean;
  onSelectProduct: (prod: Product) => void;
}

export function PlanConditionsSheet({
  plan,
  planProducts,
  isOpen,
  onClose,
  isExpired,
  isUpcoming,
  isActive,
  upcomingDaysText,
  isOrderingDisabled,
  onSelectProduct,
}: PlanConditionsSheetProps) {
  const navigate = useNavigate();
  const rawDescription =
    plan.content || plan.notes || "شرایط این طرح توسط مدیریت تعیین شده است.";

  return (
      <Drawer>
        <Drawer.Backdrop
          isOpen={isOpen}
          onOpenChange={(open) => !open && onClose()}
          className="fixed z-40 backdrop-blur-xs bg-foreground/30 min-h-60 flex items-end justify-center fade-up transition-all duration-300"
        >
          <Drawer.Content
            placement="bottom"
            className="w-full max-w-xl  mx-auto fixed z-40 bottom-0! mb-0! inset-x-0 top-auto h-auto! max-h-[92dvh] sm:max-h-[94dvh] rounded-t-3xl rounded-b-none! flex flex-col overflow-hidden border-b-0!"
          >
            <Drawer.Dialog className="flex flex-col bg-background h-auto! max-h-[92dvh] sm:max-h-[94dvh] min-h-0 outline-none text-start overscroll-contain m-0! mb-0! p-0! rounded-b-none!">
              {/* Drag Handle UI */}
              <div className="flex justify-center w-full shrink-0 pt-2 pb-1">
                <Drawer.Handle className="w-16 h-1.5 rounded-full" />
              </div>

              <Drawer.Header className="w-full flex flex-row! items-center justify-between px-5 pt-1 pb-2 shrink-0 border-b border-border/40">
                <div className="flex items-center gap-2 min-w-0 flex-1 pe-2">
                  <TagIcon className="size-4 text-primary shrink-0" />
                  <Drawer.Heading className="text-sm font-extrabold text-foreground truncate">
                    {plan.title}
                  </Drawer.Heading>
                  {isExpired && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-danger/15 text-danger shrink-0">
                      منقضی شده
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  onPress={() => onClose()}
                  aria-label="بستن"
                  className="size-9 rounded-2xl bg-muted/10 hover:bg-muted/20 text-muted hover:text-foreground flex items-center justify-center cursor-pointer transition-colors shrink-0"
                >
                  <XIcon size={16} />
                </Button>
              </Drawer.Header>

              {/* Bottom Sheet Body */}
              <Drawer.Body className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-3.5 space-y-3.5 scrollbar-none pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] text-start">
                {/* Upcoming Notice in Bottom Sheet */}
                {isUpcoming && (
                  <div className="flex items-center gap-2 p-3 rounded-2xl text-warning text-xs font-bold">
                    <ClockIcon className="size-4 shrink-0" />
                    <span>{upcomingDaysText}</span>
                  </div>
                )}

                <div className="rounded-2xl  space-y-3"></div>
                {/* Complete Unabridged Conditions */}
                <div className="space-y-2">
                  <div className="w-full flex justify-between items-center gap-3">
                    <span className="text-sm font-bold text-foreground">
                      شرایط کامل طرح
                    </span>
                    {plan.expiresAt &&
                      (isExpired ? (
                        <div className="w-auto bg-danger/15 text-danger  py-1.5 px-3 rounded-xl text-xs font-bold shrink-0">
                          منقضی شده
                        </div>
                      ) : (
                        <div className="w-auto text-primary py-1.5 px-3 rounded-xl text-xs shrink-0 flex items-center gap-1.5">
                          <span>تاریخ پایان: </span>
                          <span className="font-semibold">
                            {formatPersianDate(plan.expiresAt)}
                          </span>
                        </div>
                      ))}
                  </div>
                  <div className="p-3.5 rounded-2xl bg-muted/5 text-xs leading-relaxed text-foreground whitespace-pre-line">
                    {rawDescription}
                  </div>
                </div>

                {/* Products in Bottom Sheet */}
                {planProducts.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-foreground flex items-center gap-1.5">
                        <BoxIcon size={14} className="text-primary" />
                        <span>کالاهای شامل این طرح</span>
                      </span>
                      <span className="text-[11px] text-muted">
                        {toPersianDigits(planProducts.length)} محصول
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {planProducts.map((prod) => (
                        <PlanProductRow
                          key={prod.id}
                          prod={prod}
                          isExpired={isExpired}
                          isUpcoming={isUpcoming}
                          onSelect={onSelectProduct}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </Drawer.Body>

              {/* Bottom Sheet Footer */}
              <div className="p-4 border-t border-border/40 flex items-center justify-between gap-3 shrink-0 bg-background">
                <Button
                  variant="secondary"
                  size="sm"
                  onPress={() => onClose()}
                  className="rounded-xl text-xs font-bold"
                >
                  بستن
                </Button>

                {isExpired ? (
                  <span className="text-xs font-bold text-danger">
                    این طرح منقضی شده است
                  </span>
                ) : isActive ? (
                  planProducts.length > 0 ? (
                    isOrderingDisabled ? (
                      <span className="px-3 py-2 rounded-lg text-xs font-semibold bg-muted/15 text-muted">
                        فقط مشاهده کاتالوگ
                      </span>
                    ) : (
                      <Button
                        type="button"
                        onPress={() => {
                          const availablePlanProducts = planProducts.filter(
                            (p) =>
                              p.stockStatus !== "out_of_stock" &&
                              p.inStock !== false &&
                              !(
                                Number.isFinite(Number(p.inventorySqm)) &&
                                Number(p.inventorySqm) <= 0
                              ),
                          );
                          if (availablePlanProducts.length === 0) {
                            toast.warning(
                              "کالای ناموجود",
                              "متأسفانه در حال حاضر کالاهای این طرح ناموجود هستند.",
                            );
                            onClose();
                            navigate({ to: "/product" });
                            return;
                          }
                          availablePlanProducts.forEach((p) => {
                            selectionStore.selectProduct(p.id);
                          });
                          toast.success(
                            "محصولات طرح انتخاب شدند",
                            `${toPersianDigits(availablePlanProducts.length)} محصول از این طرح به انتخاب‌های شما اضافه شد.`,
                          );
                          onClose();
                          navigate({ to: "/product" });
                        }}
                        className="h-9 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>ثبت محصول</span>
                        </div>
                        <ArrowLeftIcon size={13} />
                      </Button>
                    )
                  ) : null
                ) : (
                  <span className="text-xs font-bold text-warning">
                    طرح به‌زودی آغاز می‌شود
                  </span>
                )}
              </div>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>
  );
}
