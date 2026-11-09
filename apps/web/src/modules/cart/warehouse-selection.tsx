import { Button } from '@heroui/react'
import { Modal } from '@/components/ui/modal'
import { useProductSelection, selectionStore } from '@/modules/products/selection-store'

export function WarehouseSelection() {
  const { candidates } = useProductSelection()
  return <Modal backdropClassName="z-[100]" isOpen={candidates.length > 0} onClose={() => selectionStore.chooseWarehouse(null)} title="انتخاب انبار تأمین">
    <p className="text-sm mb-3">یک انبار برای تأمین کل سبد انتخاب کنید.</p>
    <div className="flex flex-col gap-2">{candidates.map(warehouse => <Button key={warehouse.id} onPress={() => selectionStore.chooseWarehouse(warehouse.id)}>{warehouse.name}</Button>)}</div>
  </Modal>
}
