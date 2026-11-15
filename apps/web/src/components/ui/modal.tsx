import type { ReactNode } from 'react'
import { Modal as HeroUIModal } from '@heroui/react'
import { match } from 'ts-pattern'
import { cn } from '@/lib/utils'
import { XIcon } from './icons'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  isBottomSheetOnMobile?: boolean
  className?: string
  backdropClassName?: string
  bodyLayout?: 'scroll' | 'panel'
  density?: 'default' | 'compact'
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  isBottomSheetOnMobile = true,
  className,
  backdropClassName = 'z-50',
  bodyLayout = 'scroll',
  density = 'default',
}: ModalProps) {
  const spacing = match(density)
    .with('default', () => ({
      handle: 'pt-2.5 pb-1',
      header: 'px-6 py-3',
      close: 'w-9 control-height-9 -me-1',
      body: 'py-4 px-6',
      sheetBottom: 'pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]',
    }))
    .with('compact', () => ({
      handle: '',
      header: 'px-3 py-2',
      close: 'm-0 w-11 control-height-11',
      body: 'm-0 px-4 pt-1 pb-3',
      sheetBottom: 'pb-[calc(1rem+env(safe-area-inset-bottom,0px))]',
    }))
    .exhaustive()

  const bodyClassName = match(bodyLayout)
    .with('scroll', () => cn(
      'min-h-0 flex-1 overflow-y-auto overscroll-contain',
      spacing.body,
      isBottomSheetOnMobile && spacing.sheetBottom,
    ))
    .with('panel', () => 'flex min-h-0 flex-1 flex-col overflow-hidden p-0')
    .exhaustive()

  return (
    <HeroUIModal.Root isOpen={isOpen} onOpenChange={open => {
      if (!open) onClose()
    }}>
      <HeroUIModal.Backdrop
        isDismissable
        className={cn(
          'fixed inset-0 m-0! mb-0! flex justify-center bg-black/60 p-0 backdrop-blur-xs sm:p-4 motion-safe:animate-backdrop-enter',
          isBottomSheetOnMobile ? 'items-end sm:items-center' : 'items-center',
          backdropClassName,
        )}
      >
        <HeroUIModal.Container
          placement={isBottomSheetOnMobile ? 'auto' : 'center'}
          className="pointer-events-none m-0! mb-0! flex h-auto w-full max-w-xl flex-col items-center p-0"
        >
          <HeroUIModal.Dialog
            aria-label={title ? undefined : 'پنجرهٔ گفتگو'}
            className={cn(
              'pointer-events-auto relative z-10 m-0! mb-0! flex max-h-[90dvh] w-full flex-col overflow-hidden bg-surface text-start',
              isBottomSheetOnMobile
                ? 'rounded-t-2xl rounded-b-none border-b-0! sm:rounded-2xl motion-safe:animate-drawer-slide-up sm:motion-safe:animate-modal-enter'
                : 'rounded-2xl motion-safe:animate-modal-enter',
              density === 'compact' && 'p-1',
              className,
            )}
          >
            {isBottomSheetOnMobile && (
              <div aria-hidden="true" className={cn('flex shrink-0 justify-center sm:hidden', spacing.handle)}>
                <div className="h-1 w-10 rounded-full bg-muted/40" />
              </div>
            )}

            {title && (
              <HeroUIModal.Header className={cn('flex shrink-0 flex-row items-center justify-between gap-2', spacing.header)}>
                <HeroUIModal.Heading className="min-w-0 wrap-break-word text-sm font-bold text-foreground">
                  {title}
                </HeroUIModal.Heading>
                <HeroUIModal.CloseTrigger
                  className={cn(
                    'static flex shrink-0 cursor-pointer items-center justify-center bg-muted/10 text-muted transition-colors hover:bg-muted/20 hover:text-foreground',
                    spacing.close,
                  )}
                  aria-label="بستن پنجره"
                >
                  <XIcon aria-hidden="true" size={18} />
                </HeroUIModal.CloseTrigger>
              </HeroUIModal.Header>
            )}

            <HeroUIModal.Body className={bodyClassName}>{children}</HeroUIModal.Body>
          </HeroUIModal.Dialog>
        </HeroUIModal.Container>
      </HeroUIModal.Backdrop>
    </HeroUIModal.Root>
  )
}
