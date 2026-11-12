

import { Modal as HeroUIModal, Button, Dropdown, cn } from "@heroui/react"
import { type Order } from "@/modules/orders/order-types"
import { AlertTriangleIcon, ChevronDownIcon, CheckIcon } from "@/components/ui/icons"
import { CANCELLATION_REASONS, formatInvoiceNumber } from "./_order-helpers"

interface CancelOrderModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
  cancelReason: string;
  onCancelReasonChange: (reason: string) => void;
  isReasonOpen: boolean;
  onReasonOpenChange: (isOpen: boolean) => void;
  onConfirm: () => void;
}

export function CancelOrderModal({
  order,
  isOpen,
  onClose,
  cancelReason,
  onCancelReasonChange,
  isReasonOpen,
  onReasonOpenChange,
  onConfirm,
}: CancelOrderModalProps) {
  return (
    <HeroUIModal.Root
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
    >
      <HeroUIModal.Backdrop
        isDismissable
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-backdrop-enter"
      >
        <HeroUIModal.Container className="pointer-events-none w-full max-w-sm h-auto p-0 flex flex-col items-center">
          <HeroUIModal.Dialog className="pointer-events-auto relative w-full bg-surface rounded-2xl flex flex-col z-10 overflow-hidden animate-modal-enter text-center p-6 space-y-4">
            <div className="w-12 control-height-12 bg-danger/15 text-danger flex items-center justify-center mx-auto">
              <AlertTriangleIcon size={24} />
            </div>
            <div>
              <HeroUIModal.Heading className="text-base font-bold text-foreground">
                لغو سفارش
              </HeroUIModal.Heading>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                آیا از لغو سفارش{" "}
                <strong dir="ltr">{formatInvoiceNumber(order)}</strong> در
                مهلت ۶۰ دقیقه‌ای اطمینان دارید؟
              </p>
              <div className="mt-2.5 p-2 bg-success/15 rounded-xl text-[11px] text-success text-start">
                اقلام سفارش به موجودی انبار بازگردانده می‌شوند.
              </div>
            </div>

            {/* Cancellation Reason Selector with HeroUI Dropdown */}
            <div className="text-start space-y-1.5 w-full">
              <label className="text-[11px] font-bold text-foreground block">
                دلیل لغو:
              </label>
              <Dropdown
                className="w-full"
                isOpen={isReasonOpen}
                onOpenChange={onReasonOpenChange}
              >
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full justify-between control-height-11 px-3.5 bg-muted/5 text-foreground font-semibold text-xs flex items-center cursor-pointer hover:bg-muted/10 transition-colors border-none shadow-none"
                >
                  <span className="truncate">{cancelReason}</span>
                  <ChevronDownIcon
                    size={16}
                    className={cn(
                      "text-muted transition-transform duration-200 shrink-0 ms-2",
                      isReasonOpen && "rotate-180",
                    )}
                  />
                </Button>

                <Dropdown.Popover
                  dir="rtl"
                  placement="bottom"
                  className="w-[var(--trigger-width)] text-right rounded-2xl p-1.5 bg-surface z-60 shadow-xl border border-border/20"
                >
                  <Dropdown.Menu
                    dir="rtl"
                    className="text-right"
                    selectionMode="single"
                    selectedKeys={new Set([cancelReason])}
                    onAction={(key) => {
                      onCancelReasonChange(String(key));
                      onReasonOpenChange(false);
                    }}
                    onSelectionChange={(keys) => {
                      const selected = Array.from(keys)[0] as string;
                      if (selected) onCancelReasonChange(selected);
                      onReasonOpenChange(false);
                    }}
                  >
                    {CANCELLATION_REASONS.map((reason) => {
                      const isSelected = cancelReason === reason;
                      return (
                        <Dropdown.Item
                          key={reason}
                          id={reason}
                          textValue={reason}
                          className={cn(
                            "rounded-xl w-full px-3 py-2.5 text-xs font-semibold cursor-pointer transition-colors flex items-center justify-between text-right w-full",
                            isSelected
                              ? "bg-primary/15 text-primary"
                              : "hover:bg-default/20 text-foreground",
                          )}
                        >
                          <span className="truncate">{reason}</span>
                          {isSelected && (
                            <CheckIcon
                              size={14}
                              className="shrink-0 text-primary ms-2"
                            />
                          )}
                        </Dropdown.Item>
                      );
                    })}
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
            </div>

            <div className="w-full flex items-center gap-3 pt-2">
              <Button
                type="button"
                onPress={() => onClose()}
                className="control-height-10 w-full px-4 bg-muted/5 text-foreground text-xs font-bold hover:bg-muted/15 cursor-pointer transition-all"
              >
                انصراف
              </Button>
              <Button
                type="button"
                onPress={onConfirm}
                className="control-height-10 w-full px-4 bg-danger hover:bg-danger/90 text-danger-foreground text-xs font-bold cursor-pointer transition-all"
              >
                تأیید لغو سفارش
              </Button>
            </div>
          </HeroUIModal.Dialog>
        </HeroUIModal.Container>
      </HeroUIModal.Backdrop>
    </HeroUIModal.Root>
  );
}
