import { Button } from '@heroui/react'
import { useProductSelection, selectionStore } from '@/modules/products/selection-store'

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
