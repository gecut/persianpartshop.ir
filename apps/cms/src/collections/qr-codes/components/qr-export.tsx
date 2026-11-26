'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSelection } from '@payloadcms/ui'
import { selectedIds } from './_selected-ids'

const box = { display: 'grid', gap: 12, padding: 16, marginBottom: 16, border: '1px solid var(--theme-elevation-150)', borderRadius: 8 } as const
const row = { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' } as const

export function QrExport() {
  const router = useRouter()
  const { selected } = useSelection()
  const [count, setCount] = useState(10)
  const [store, setStore] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const ids = selectedIds(selected)

  async function generate() {
    setBusy(true); setMessage('')
    try {
      const response = await fetch('/api/qr-codes/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ count, store }),
      })
      const data = (await response.json().catch(() => ({}))) as { ids?: number[]; error?: string }
      if (!response.ok) throw new Error(data.error ?? 'ساخت کدها ممکن نشد.')
      setMessage(`${data.ids?.length ?? 0} کد جدید ساخته شد.`)
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ساخت کدها ممکن نشد.')
    } finally { setBusy(false) }
  }

  async function exportZip() {
    setBusy(true); setMessage('')
    try {
      const response = await fetch('/api/qr-codes/export', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }),
      })
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error ?? 'دریافت خروجی ممکن نشد.')
      }
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = 'qr-labels.zip'
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'دریافت خروجی ممکن نشد.')
    } finally { setBusy(false) }
  }

  return (
    <section dir="rtl" style={box} aria-label="ساخت و دریافت کدهای QR">
      <div style={row}>
        <label>تعداد <input type="number" min={1} max={500} value={count} onChange={(e) => setCount(Number(e.target.value))} /></label>
        <label>فروشگاه / محل <input type="text" maxLength={120} value={store} onChange={(e) => setStore(e.target.value)} /></label>
        <button type="button" className="btn btn--style-primary btn--size-small" disabled={busy || count < 1 || count > 500} onClick={() => void generate()}>ساخت کدهای جدید</button>
      </div>
      <div style={row}>
        <button type="button" className="btn btn--style-secondary btn--size-small" disabled={busy || ids.length === 0} onClick={() => void exportZip()}>
          دریافت خروجی QR (ZIP) — {ids.length} کد انتخاب‌شده
        </button>
      </div>
      {message && <p role="status">{message}</p>}
    </section>
  )
}
