import { Modal as HeroUIModal, Button } from "@heroui/react"
import { LogOutIcon } from "@/components/ui/icons"

interface LogoutConfirmModalProps {
  isOpen: boolean;
  isConfirmDisabled: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function LogoutConfirmModal({ isOpen, isConfirmDisabled, onCancel, onConfirm }: LogoutConfirmModalProps) {
  return (
    <HeroUIModal.Root
      isOpen={isOpen}
      onOpenChange={(open) => !open && onCancel()}
    >
      <HeroUIModal.Backdrop
        isDismissable
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-backdrop-enter"
      >
        <HeroUIModal.Container className="pointer-events-none w-full max-w-sm h-auto p-0 flex flex-col items-center">
          <HeroUIModal.Dialog className="pointer-events-auto relative w-full bg-surface rounded-2xl flex flex-col z-10 overflow-hidden animate-modal-enter text-center p-6 space-y-4">
            <div className="w-12 control-height-12 bg-danger/15 text-danger flex items-center justify-center mx-auto">
              <LogOutIcon size={24} />
            </div>
            <div>
              <HeroUIModal.Heading className="text-base font-bold text-foreground">
                خروج از حساب کاربری
              </HeroUIModal.Heading>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                با خروج، سبد و تمام پیش‌نویس‌های این حساب در دستگاه حذف می‌شوند. ادامه می‌دهید؟
              </p>
            </div>
            <div className="w-full flex items-center justify-center gap-1.5 pt-2">
              <Button
                type="button"
                onPress={onCancel}
                className="control-height-12 px-4 w-full bg-muted/10 text-foreground text-xs font-bold hover:bg-muted/15 cursor-pointer transition-all"
              >
                انصراف
              </Button>
              <Button
                type="button"
                isDisabled={isConfirmDisabled}
                onPress={onConfirm}
                className="control-height-12 px-4 w-full bg-danger/15 text-danger hover:bg-danger/20 font-bold text-xs cursor-pointer transition-all"
              >
                تأیید خروج
              </Button>
            </div>
          </HeroUIModal.Dialog>
        </HeroUIModal.Container>
      </HeroUIModal.Backdrop>
    </HeroUIModal.Root>
  );
}
