import { Modal } from '@/components/ui/modal'
import { SupplyRequestForm } from './supply-request-form'

interface SupplyRequestModalProps {
  productId: number
  onClose: () => void
  onPurchase: () => void
  onSuccess: (id: number) => void
}

export function SupplyRequestModal({ productId, onClose, onPurchase, onSuccess }: SupplyRequestModalProps) {
  return <Modal isOpen onClose={onClose} title="درخواست تأمین" bodyLayout="panel">
    <SupplyRequestForm productId={productId} presentation="modal" onSuccess={onSuccess} onPurchase={onPurchase} />
  </Modal>
}
