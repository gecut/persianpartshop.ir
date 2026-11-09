import { Modal as HeroUIModal, Button } from "@heroui/react"
import { formatPersianDate } from "@/lib/utils/date"
import { XIcon, FileTextIcon, CheckCircle2Icon } from "@/components/ui/icons"
import { getDocFileUrl, type CustomerDocument } from "./_document-types"

interface ImagePreviewModalProps {
  doc: CustomerDocument | null;
  onClose: () => void;
}

export function ImagePreviewModal({ doc: previewDoc, onClose }: ImagePreviewModalProps) {
  return (
    <HeroUIModal.Root
      isOpen={!!previewDoc}
      onOpenChange={(open) => !open && onClose()}
    >
      <HeroUIModal.Backdrop
        isDismissable
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-backdrop-enter"
      >
        <HeroUIModal.Container className="pointer-events-none w-full max-w-lg h-auto p-0 flex flex-col items-center">
          <HeroUIModal.Dialog className="pointer-events-auto relative w-full bg-surface rounded-2xl flex flex-col z-10 overflow-hidden animate-modal-enter text-start p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/10 pb-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <FileTextIcon size={16} className="text-muted shrink-0" />
                <HeroUIModal.Heading className="text-xs sm:text-sm font-bold text-foreground truncate">
                  {previewDoc?.title || "مشاهده مدرک"}
                </HeroUIModal.Heading>
              </div>
              <Button
                type="button"
                onPress={() => onClose()}
                className="size-8 rounded-xl bg-muted/10 hover:bg-muted/20 text-muted hover:text-foreground flex items-center justify-center cursor-pointer transition-colors"
              >
                <XIcon size={16} />
              </Button>
            </div>

            {previewDoc && getDocFileUrl(previewDoc.file) && (
              <div className="rounded-xl overflow-hidden bg-black/5 flex items-center justify-center max-h-[70vh]">
                <img
                  src={getDocFileUrl(previewDoc.file)!}
                  alt={previewDoc.title || "مدرک"}
                  className="max-h-[70vh] w-auto object-contain rounded-xl"
                />
              </div>
            )}

            <div className="flex items-center justify-between text-[11px] text-muted pt-1">
              <span>
                تاریخ بارگذاری: {formatPersianDate(previewDoc?.uploadedAt)}
              </span>
              {previewDoc?.status === "approved" && (
                <span className="text-success font-bold flex items-center gap-1">
                  <CheckCircle2Icon size={12} />
                  <span>تأیید شده و قفل</span>
                </span>
              )}
            </div>
          </HeroUIModal.Dialog>
        </HeroUIModal.Container>
      </HeroUIModal.Backdrop>
    </HeroUIModal.Root>
  );
}
