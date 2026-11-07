'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { StockImportMode, StockImportPreview, WarehouseSummary } from '@persianpart/contract'
import styles from './stock-import.module.css'

const modeInfo: Record<StockImportMode, string> = {
  stock: 'CSV با ستون‌های sku و inventorySqm؛ موجودی برای انبار انتخاب‌شده جایگزین می‌شود.',
  price: 'CSV با ستون‌های sku و basePricePerSqm؛ قیمت پایه به تومان و برای همه انبارها تغییر می‌کند.',
  kimia: 'خروجی CSV کیمیا تجارت؛ قیمت ریالی به تومان تبدیل و موجودی انبار انتخاب‌شده جایگزین می‌شود.',
}

export function StockImport() {
  const router = useRouter()
  const fileInput = useRef<HTMLInputElement>(null)
  const fileRead = useRef(0)
  const [mode, setMode] = useState<StockImportMode>('stock')
  const [filename, setFilename] = useState('')
  const [warehouses, setWarehouses] = useState<WarehouseSummary[]>([])
  const [warehouseId, setWarehouseId] = useState('')
  const [exportPage, setExportPage] = useState(1)
  const [csv, setCsv] = useState('')
  const [preview, setPreview] = useState<StockImportPreview | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
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
      } catch (cause) {
        if (active) { setError(true); setMessage(cause instanceof Error ? cause.message : 'خطای ارتباط') }
      }
    })()
    return () => { active = false; fileRead.current++ }
  }, [])

  const submit = async (apply: boolean) => {
    setBusy(true); setMessage(''); setError(false)
    try {
      const response = await fetch(`/api/warehouse-stock/${apply ? 'apply' : 'preview'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apply ? { token: preview?.token } : { mode, warehouseId: mode === 'price' ? undefined : Number(warehouseId), csv }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'عملیات ممکن نشد.')
      if (apply) {
        setPreview(null); setCsv(''); setFilename('')
        if (fileInput.current) fileInput.current.value = ''
        setMessage(`تغییرات ${Number(data.updated).toLocaleString('fa-IR')} کالا ثبت شد.`)
        router.refresh()
      } else setPreview(data)
    } catch (cause) {
      setPreview(null); setError(true); setMessage(cause instanceof Error ? cause.message : 'خطای ارتباط')
    } finally { setBusy(false) }
  }

  const chooseFile = async (file: File | undefined) => {
    const readId = ++fileRead.current
    setCsv(''); setFilename(''); setPreview(null); setMessage(''); setError(false)
    if (!file) return
    if (file.size > 1_000_000) { setError(true); setMessage('حداکثر اندازه فایل یک مگابایت است.'); return }
    try {
      const bytes = await file.arrayBuffer()
      let text: string
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
      catch { text = new TextDecoder('windows-1256').decode(bytes) }
      if (readId !== fileRead.current) return
      setFilename(file.name); setCsv(text)
    } catch {
      if (readId === fileRead.current) { setError(true); setMessage('خواندن فایل ممکن نشد.') }
    }
  }

  const format = (value: number | null | undefined) => value == null ? '—' : value.toLocaleString('fa-IR')
  const needsWarehouse = mode !== 'price'
  return (
    <section className={styles.panel} dir="rtl" aria-labelledby="stock-import-title">
      <div className={styles.header}>
        <div><h2 id="stock-import-title">به‌روزرسانی گروهی کالاها</h2><p>فایل را وارد کنید و تغییرات را پیش از ثبت بررسی کنید.</p></div>
      </div>
      <div className={styles.body}>
        <div className={styles.controls}>
          <div className={styles.field}>
            <label htmlFor="import-mode">نحوه پردازش</label>
            <select id="import-mode" disabled={busy} value={mode} onChange={event => { fileRead.current++; setMode(event.target.value as StockImportMode); setCsv(''); setFilename(''); setPreview(null); setMessage('') }}>
              <option value="stock">موجودی عادی</option><option value="price">قیمت عادی</option><option value="kimia">خروجی کیمیا تجارت</option>
            </select>
          </div>
          {needsWarehouse && <div className={styles.field}>
            <label htmlFor="warehouse-import-target">انبار</label>
            <select id="warehouse-import-target" disabled={busy} value={warehouseId} onChange={event => { setWarehouseId(event.target.value); setPreview(null) }}>
              <option value="">انتخاب انبار</option>{warehouses.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>}
        </div>
        {mode === 'price' && <details className={styles.export}>
          <summary>دریافت فایل قیمت کالاها</summary>
          <div className={styles.exportControls}>
            <label htmlFor="export-page">شماره صفحه</label>
            <input id="export-page" type="number" min={1} max={1000000} value={exportPage} onChange={event => setExportPage(Math.max(1, Math.min(1000000, Number(event.target.value) || 1)))} />
            <a className={styles.secondary} href={`/api/warehouse-stock/export?mode=price&page=${exportPage}`}>دریافت فایل قیمت</a>
            <span>هر صفحه تا ۱۰۰۰ کالا</span>
          </div>
        </details>}
        <div className={styles.upload}>
          <div><strong>فایل CSV</strong><p>{modeInfo[mode]}</p><p>تا ۱۰۰۰ ردیف و ۱ مگابایت</p></div>
          <button className={styles.secondary} type="button" disabled={busy} onClick={() => fileInput.current?.click()}>{filename ? 'تغییر فایل' : 'انتخاب فایل CSV'}</button>
          <input ref={fileInput} className={styles.fileInput} tabIndex={-1} type="file" aria-label="فایل CSV" accept=".csv,text/csv" disabled={busy} onChange={event => { void chooseFile(event.target.files?.[0]); event.currentTarget.value = '' }} />
          {filename && <span className={styles.filename}><bdi>{filename}</bdi></span>}
        </div>
        {needsWarehouse && <p className={styles.hint}>موجودی فایل باید قابل فروش و پس از کسر رزروها باشد. کالاهای خارج از فایل تغییر نمی‌کنند.</p>}
        <details className={styles.manual}><summary>ویرایش دستی محتوای فایل</summary><textarea aria-label="محتوای CSV" dir="ltr" rows={5} value={csv} disabled={busy} onChange={event => { fileRead.current++; setCsv(event.target.value); setPreview(null); setFilename('') }} /></details>
        <div className={styles.actions}><button className={styles.primary} type="button" disabled={busy || (needsWarehouse && !warehouseId) || !csv} onClick={() => { void submit(false) }}>بررسی و پیش‌نمایش</button></div>
        {preview && <div className={styles.preview}>
          <div className={styles.previewHeader}><strong>نتیجه بررسی فایل</strong><p>کل: {format(preview.total)}، قابل ثبت: {format(preview.rows.length)}، ردشده: {format(preview.errors.length)}؛ تغییر قیمت: {format(preview.priceChanges)}، تغییر موجودی: {format(preview.stockChanges)}</p></div>
          {preview.errors.length > 0 && <div className={styles.tableWrap}><table><thead><tr><th>ردیف</th><th>کد کالا</th><th>علت رد</th></tr></thead><tbody>{preview.errors.map(item => <tr key={item.rowNumber}><td>{format(item.rowNumber)}</td><td><bdi>{item.sku || '—'}</bdi></td><td>{item.message}</td></tr>)}</tbody></table></div>}
          {preview.rows.length > 0 && <div className={styles.tableWrap}><table><thead><tr><th>ردیف</th><th>کالا / کد</th>{mode !== 'stock' && <><th>قیمت فعلی (تومان)</th><th>قیمت جدید (تومان)</th></>}{mode !== 'price' && <><th>موجودی فعلی</th><th>موجودی جدید</th></>}</tr></thead><tbody>{preview.rows.map(row => <tr key={row.productId}><td>{format(row.rowNumber)}</td><td>{row.name} · <bdi>{row.sku}</bdi></td>{mode !== 'stock' && <><td>{format(row.previousPrice)}</td><td>{format(row.basePricePerSqm)}</td></>}{mode !== 'price' && <><td>{format(row.previousInventory)}</td><td>{format(row.inventorySqm)}</td></>}</tr>)}</tbody></table></div>}
          <div className={styles.confirm}><span>فقط ردیف‌های معتبر ثبت می‌شوند؛ ردیف‌های ردشده تغییری نمی‌کنند.</span><button className={styles.primary} type="button" disabled={busy || !preview.token} onClick={() => { void submit(true) }}>تأیید و ثبت ردیف‌های معتبر</button></div>
        </div>}
        {(busy || message) && <p className={error ? styles.error : styles.status} role={error ? 'alert' : 'status'}>{busy ? 'در حال پردازش…' : message}</p>}
      </div>
    </section>
  )
}
