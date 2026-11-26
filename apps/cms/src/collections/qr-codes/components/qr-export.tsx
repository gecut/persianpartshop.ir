'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, useSelection } from '@payloadcms/ui'
import { selectedIds } from './_selected-ids'

const box = { display: 'grid', gap: 12, padding: 16, marginBottom: 16, border: '1px solid var(--theme-elevation-150)', borderRadius: 8 } as const
const row = { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' } as const

function canManageQrClient(user: unknown): boolean {
  if (!user || typeof user !== 'object') return false
  const u = user as Record<string, unknown>
  if (u.collection !== 'admins' || u.isActive === false) return false
  if (u.role === 'manager' || u.role === 'superadmin') return true
  if (Array.isArray(u.roles)) return u.roles.some((r) => r === 'manager' || r === 'superadmin')
  return false
}

function downloadFilename(disposition: string | null): string {
  if (!disposition) return 'qr-labels.zip'
  const match = /filename\*?=(?:UTF-8''|")?([^";\n]+)"?/i.exec(disposition)
  return match?.[1]?.trim() || 'qr-labels.zip'
}

export function QrExport() {
  const router = useRouter()
  const { user } = useAuth()
  const { selected, selectAll } = useSelection()
  const [countInput, setCountInput] = useState('10')
  const [store, setStore] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  if (!canManageQrClient(user)) return null

  const ids = selectedIds(selected)
  const trimmedCount = countInput.trim()
  const parsedCount = trimmedCount === '' ? Number.NaN : Number(trimmedCount)
  const isValidCount = Number.isInteger(parsedCount) && parsedCount >= 1 && parsedCount <= 500
  const isAllAvailable = selectAll === 'allAvailable'
  const exportDisabled = busy || isAllAvailable || ids.length === 0 || ids.length > 500

  async function generate() {
    if (!isValidCount) return
    setBusy(true); setMessage('')
    try {
      const response = await fetch('/api/qr-codes/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ count: parsedCount, store }),
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
      const blob = await response.blob().catch(() => {
        throw new Error('دریافت خروجی نیمه‌کاره ماند؛ دوباره تلاش کنید.')
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = downloadFilename(response.headers.get('Content-Disposition'))
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'دریافت خروجی ممکن نشد.')
    } finally { setBusy(false) }
  }

  return (
    <section dir="rtl" style={box} aria-label="ساخت و دریافت کدهای QR">
      <div style={row}>
        <label>تعداد <input type="number" min={1} max={500} value={countInput} onChange={(e) => setCountInput(e.target.value)} /></label>
        <label>فروشگاه / محل <input type="text" maxLength={120} value={store} onChange={(e) => setStore(e.target.value)} /></label>
        <button type="button" className="btn btn--style-primary btn--size-small" disabled={busy || !isValidCount} onClick={() => void generate()}>ساخت کدهای جدید</button>
      </div>
      <div style={row}>
        <button type="button" className="btn btn--style-secondary btn--size-small" disabled={exportDisabled} onClick={() => void exportZip()}>
          دریافت خروجی QR (ZIP) — {ids.length} کد انتخاب‌شده
        </button>
        {isAllAvailable && <span>برای خروجی، ردیفها را در همین صفحه انتخاب کنید (حداکثر ۵۰۰).</span>}
      </div>
      {message && <p role="status">{message}</p>}
    </section>
  )
}
