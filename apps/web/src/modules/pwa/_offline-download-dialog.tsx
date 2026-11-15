import { Button, Modal } from '@heroui/react'
import { ArrowRightIcon, PauseIcon } from '@solar-icons/react/linear'
import type { OfflineProgress } from './_download-offline-data'
import { OfflineDownloadProgress } from './_offline-download-progress'

interface OfflineDownloadDialogProps {
  progress: OfflineProgress
  onPause: () => void
  onClose: () => void
}

export function OfflineDownloadDialog({ progress, onPause, onClose }: OfflineDownloadDialogProps) {
  return (
    <Modal.Root isOpen onOpenChange={open => { if (!open) onClose() }}>
      <Modal.Backdrop isDismissable={false} className="z-70">
        <Modal.Container size="full" placement="center">
          <Modal.Dialog className="items-center overflow-y-auto overscroll-contain bg-linear-to-b from-surface-secondary via-background to-background p-0! text-center">
            <div className="my-auto flex w-full max-w-lg flex-col items-center gap-6 px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:gap-8">
              <header className="flex flex-col items-center gap-2">
                <Modal.Heading className="text-xl font-bold sm:text-2xl">دریافت بستهٔ آفلاین</Modal.Heading>
                <p className="text-pretty text-sm/6 text-muted">داده‌ها روی این دستگاه ذخیره می‌شوند تا بدون اینترنت در دسترس باشند.</p>
              </header>

              <OfflineDownloadProgress progress={progress} expanded />

              <footer className="flex flex-col items-center gap-2.5">
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="outline" onPress={onPause}>
                    <PauseIcon aria-hidden="true" size={18} />
                    مکث دانلود
                  </Button>
                  <Button variant="ghost" onPress={onClose}>
                    <ArrowRightIcon aria-hidden="true" size={18} />
                    بازگشت به برنامه
                  </Button>
                </div>
                <p className="text-pretty text-xs/5 text-muted">با بازگشت به برنامه، دانلود در پس‌زمینه ادامه دارد.</p>
              </footer>
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal.Root>
  )
}
