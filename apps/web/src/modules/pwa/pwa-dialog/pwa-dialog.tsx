import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { match } from 'ts-pattern'
import { Modal } from '@/components/ui/modal'
import { AppleMobileInstallView } from './_apple-mobile-install-view'
import { InstalledView } from './_installed-view'
import { MacSafariInstallView } from './_mac-safari-install-view'
import { ManualInstallView } from './_manual-install-view'
import { NativeInstallView } from './_native-install-view'
import { UpdateView } from './_update-view'

export type PwaDialogView =
  | { kind: 'installed' }
  | { kind: 'native'; installing: boolean; onInstall: () => void }
  | { kind: 'apple-mobile' }
  | { kind: 'mac-safari' }
  | { kind: 'manual' }
  | { kind: 'update'; canUpdate: boolean; hasWrites: boolean; busy: boolean; error: string | null; onUpdate: () => void }

interface PwaDialogProps {
  view: PwaDialogView | null
  onClose: () => void
  offlineContent: ReactNode
}

function renderView(view: PwaDialogView) {
  return match(view)
    .with({ kind: 'installed' }, () => <InstalledView />)
    .with({ kind: 'native' }, ({ installing, onInstall }) => (
      <NativeInstallView installing={installing} onInstall={onInstall} />
    ))
    .with({ kind: 'apple-mobile' }, () => <AppleMobileInstallView />)
    .with({ kind: 'mac-safari' }, () => <MacSafariInstallView />)
    .with({ kind: 'manual' }, () => <ManualInstallView />)
    .with({ kind: 'update' }, ({ canUpdate, hasWrites, busy, error, onUpdate }) => (
      <UpdateView canUpdate={canUpdate} hasWrites={hasWrites} busy={busy} error={error} onUpdate={onUpdate} />
    ))
    .exhaustive()
}

export function PwaDialog({ view, onClose, offlineContent }: PwaDialogProps) {
  const content = useRef<HTMLDivElement>(null)
  const viewKind = view?.kind

  useLayoutEffect(() => {
    // A native prompt can replace the focused installation button with a guide or confirmation.
    if (viewKind && document.activeElement === document.body) {
      content.current?.querySelector<HTMLElement>('[data-pwa-view-heading]')?.focus()
    }
  }, [viewKind])

  return (
    <Modal isOpen={view !== null} onClose={onClose} title="برنامهٔ پرشین‌پارت" density="compact">
      <div ref={content} className="space-y-4">
        {view && renderView(view)}
        {offlineContent}
      </div>
    </Modal>
  )
}
