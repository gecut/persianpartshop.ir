'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { StockImportRow, WarehouseSummary } from '@persianpart/contract'

export function StockImport() {
  const router = useRouter()
  const fileInput = useRef<HTMLInputElement>(null)
  const [filename, setFilename] = useState('')
  const [warehouses, setWarehouses] = useState<WarehouseSummary[]>([])
  const [warehouseId, setWarehouseId] = useState('')
  const [csv, setCsv] = useState('')
  const [preview, setPreview] = useState<{ token: string; rows: StockImportRow[] } | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true
    void (async () => {
      const found: WarehouseSummary[] = []
      let page = 1
      try {
        while (true) {
          const response = await fetch(`/api/warehouses?where[isActive][equals]=true&limit=100&page=${page}&depth=0`)
          if (!response.ok) throw new Error('دریافت انبارها ممکن نشد.')
          const data = await response.json()
          found.push(...data.docs)
          if (!data.hasNextPage) break
          page++
        }
        if (active) setWarehouses(found)
      } catch (error) { if (active) setMessage(error instanceof Error ? error.message : 'خطای ارتباط') }
    })()
    return () => { active = false }
  }, [])
  const submit = async (apply: boolean) => {
    setBusy(true); setMessage('')
    try {
      const response = await fetch(`/api/warehouse-stock/${apply ? 'apply' : 'preview'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apply ? { token: preview?.token } : { warehouseId: Number(warehouseId), csv }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'عملیات ممکن نشد.')
      if (apply) { setPreview(null); setMessage(`موجودی ${Number(data.updated).toLocaleString('fa-IR')} کالا ثبت شد.`); router.refresh() }
      else setPreview(data)
    } catch (error) { setPreview(null); setMessage(error instanceof Error ? error.message : 'خطای ارتباط') }
    finally { setBusy(false) }
  }
  return <section dir="rtl" style={{ padding: '1rem', border: '1px solid var(--theme-elevation-200)', marginBlockEnd: '1rem' }}>
    <h2>ورود موجودی انبار</h2>
    <p>فایل باید به‌روز و شامل موجودی قابل فروش پس از کسر رزروها باشد. عدد هر ردیف بر اساس واحد فروش اصلی همان کالا است (کاشی: متر مربع، کالای دیگر: کیسه، عدد و مانند آن). ستون‌ها: <bdi>sku,inventorySqm</bdi>. ردیف‌های غایب تغییر نمی‌کنند.</p>
    <label htmlFor="warehouse-import-target">انبار تأمین</label> <select id="warehouse-import-target" disabled={busy} value={warehouseId} onChange={event => { setWarehouseId(event.target.value); setPreview(null) }}>
      <option value="">انتخاب انبار</option>{warehouses.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
    <p><button type="button" disabled={busy} onClick={() => fileInput.current?.click()}>انتخاب فایل CSV</button> <span>{filename}</span><input ref={fileInput} hidden type="file" aria-label="فایل CSV" accept=".csv,text/csv" disabled={busy} onChange={event => {
      const file = event.target.files?.[0]
      if (file && file.size <= 1_000_000) { setFilename(file.name); void file.text().then(text => { setCsv(text); setPreview(null) }).catch(() => setMessage('خواندن فایل ممکن نشد.')) }
      else setMessage('حداکثر اندازهٔ فایل یک مگابایت است.')
    }} /></p>
    <label>محتوای CSV (برای ورود دستی نیز قابل ویرایش است)<textarea dir="ltr" rows={5} value={csv} disabled={busy} onChange={event => { setCsv(event.target.value); setPreview(null) }} style={{ display: 'block', width: '100%' }} /></label>
    <button type="button" disabled={busy || !warehouseId || !csv} onClick={() => { void submit(false) }}>پیش‌نمایش</button>
    {warehouseId && <a style={{ marginInlineStart: '1rem' }} href={`/api/warehouse-stock/export?warehouseId=${warehouseId}`}>دریافت خروجی موجودی این انبار</a>}
    {preview && <div style={{ maxHeight: '20rem', overflow: 'auto' }}><table><thead><tr><th>کد کالا</th><th>موجودی قابل فروش جدید</th></tr></thead><tbody>{preview.rows.map(row => <tr key={row.productId}><td><bdi>{row.sku}</bdi></td><td>{row.inventorySqm.toLocaleString('fa-IR')}</td></tr>)}</tbody></table>
      <button type="button" disabled={busy} onClick={() => { void submit(true) }}>تأیید و اعمال موجودی</button></div>}
    <p role="status">{busy ? 'در حال پردازش…' : message}</p>
  </section>
}
