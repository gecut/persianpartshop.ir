import { Button } from '@heroui/react'
import { Modal } from '../../components/ui/modal'
import { useProductSelection, selectionStore } from '../products/selection-store'

export function WarehouseSelection() {
  const { candidates } = useProductSelection()
  return <Modal backdropClassName="z-[100]" isOpen={candidates.length > 0} onClose={() => selectionStore.chooseWarehouse(null)} title="انتخاب انبار تأمین">
    <p className="text-sm mb-3">یک انبار برای تأمین کل سبد انتخاب کنید.</p>
    <div className="flex flex-col gap-2">{candidates.map(warehouse => <Button key={warehouse.id} onPress={() => selectionStore.chooseWarehouse(warehouse.id)}>{warehouse.name}</Button>)}</div>
  </Modal>
}

export function WarehouseSummary() {
  const { warehouse, busy, error, selectedIds, quotes } = useProductSelection()
  if (!selectedIds.length && !busy && !error) return null
  return <div className="p-3 rounded-2xl bg-muted/5 text-sm space-y-2" aria-live="polite">
    <p>انبار تأمین: {warehouse?.name ?? 'نیازمند انتخاب'}</p>
    {busy && <p role="status">در حال بررسی موجودی…</p>}
    {error && <p role="alert" className="text-danger">{error}</p>}
    {!busy && selectedIds.length > 0 && !quotes.length && <Button onPress={() => { void selectionStore.revalidate() }}>بررسی دوبارهٔ موجودی</Button>}
  </div>
}
