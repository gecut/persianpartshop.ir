import React, { useEffect } from 'react'
import { Modal as HeroUIModal } from '@heroui/react'
import { XIcon } from './icons'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  isBottomSheetOnMobile?: boolean
  className?: string
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  isBottomSheetOnMobile = true,
  className = '',
}: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  return (
    <HeroUIModal.Root isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <HeroUIModal.Backdrop
        isDismissable
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 m-0! mb-0! sm:p-4 animate-backdrop-enter"
      >
        <HeroUIModal.Container className="pointer-events-none w-full max-w-xl h-auto p-0 m-0! mb-0! flex flex-col items-center justify-end sm:justify-center">
          <HeroUIModal.Dialog
            className={`pointer-events-auto relative w-full bg-surface z-10 text-start overflow-hidden m-0! mb-0! ${
              isBottomSheetOnMobile
                ? 'rounded-t-2xl rounded-b-none sm:rounded-2xl max-h-[90dvh] flex flex-col animate-drawer-slide-up sm:animate-modal-enter border-b-0!'
                : 'rounded-2xl max-h-[90dvh] my-auto animate-modal-enter'
            } ${className}`}
          >
            {/* Mobile handle indicator */}
            {isBottomSheetOnMobile && (
              <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
                <div className="w-10 h-1 rounded-full bg-muted/40" />
              </div>
            )}

            {/* Header */}
            {title && (
              <HeroUIModal.Header className="flex items-center justify-between px-4.5 py-3">
                <HeroUIModal.Heading className="text-sm font-bold text-foreground">
                  {title}
                </HeroUIModal.Heading>
                <HeroUIModal.CloseTrigger
                  onClick={onClose}
                  className="size-9 rounded-2xl -me-1 text-muted hover:text-foreground bg-muted/10 hover:bg-muted/20 flex items-center justify-center transition-all cursor-pointer active:scale-90"
                  aria-label="بستن پنجره"
                >
                  <XIcon size={18} />
                </HeroUIModal.CloseTrigger>
              </HeroUIModal.Header>
            )}

            {/* Body */}
            <HeroUIModal.Body
              className={`p-4 overflow-y-auto overscroll-contain flex-1 ${
                isBottomSheetOnMobile ? 'pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]' : ''
              }`}
            >
              {children}
            </HeroUIModal.Body>
          </HeroUIModal.Dialog>
        </HeroUIModal.Container>
      </HeroUIModal.Backdrop>
    </HeroUIModal.Root>
  )
}

