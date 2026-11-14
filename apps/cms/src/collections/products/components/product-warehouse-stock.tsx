'use client'

import { useConfig, useDocumentInfo } from '@payloadcms/ui'
import { useEffect, useState } from 'react'
import type { Product, Warehouse, WarehouseStock } from '../../../payload-types'
import styles from './product-warehouse-stock.module.css'

type StockRow = {
  warehouse: Pick<Warehouse, 'id' | 'name' | 'stockMode' | 'isActive'>
  balance: (Pick<WarehouseStock, 'revision' | 'isActive' | 'lastReportedAt'> & { amount: number | null }) | null
}

type StockView = Pick<Product, 'productType' | 'unit'> & {
  canEdit: boolean
  salesFactor: number
  rows: StockRow[]
}

const units: Record<NonNullable<Product['unit']>, string> = {
  bag: 'کیسه', bucket: 'سطل', pack: 'بسته', can: 'قوطی', branch: 'شاخه', piece: 'عدد',
  box: 'کارتن', roll: 'رول', kg: 'کیلوگرم', liter: 'لیتر',
}
const number = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 })
const date = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeZone: 'Asia/Tehran' })

export function ProductWarehouseStock() {
  const { id } = useDocumentInfo()
  const { config } = useConfig()
  const url = id == null ? null : `${config.routes.api}/warehouse-stock/for-product/${id}`
  return url ? <WarehouseBalances key={url} url={url} /> : <p>برای مدیریت موجودی، ابتدا محصول را ذخیره کنید.</p>
}

function WarehouseBalances({ url }: { url: string }) {
  const [view, setView] = useState<StockView>()
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState<number>()
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch(url, { signal: controller.signal, cache: 'no-store' })
        if (response.status === 403) {
          setView(undefined)
          setNotice('دسترسی مشاهدهٔ موجودی انبارها را ندارید.')
          return
        }
        if (!response.ok) throw new Error()
        setView(await response.json() as StockView)
      } catch {
        if (!controller.signal.aborted) {
          setView(undefined)
          setNotice('دریافت موجودی ممکن نشد.')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [url, reload])

  function refresh() {
    setLoading(true)
    setEditing(undefined)
    setReload(value => value + 1)
  }

  async function save(row: StockRow, amount: number | null) {
    setBusy(true)
    setNotice('')
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ warehouseId: row.warehouse.id, revision: row.balance?.revision ?? null, amount }),
      })
      if (response.ok) {
        setNotice('موجودی ثبت شد.')
        refresh()
      } else {
        const result = await response.json().catch(() => null)
        setNotice(result?.errors?.[0]?.message ?? 'ثبت موجودی ممکن نشد.')
        if (response.status === 409) refresh()
      }
    } catch {
      setNotice('نتیجهٔ ثبت مشخص نیست. موجودی دوباره دریافت می‌شود.')
      refresh()
    } finally {
      setBusy(false)
    }
  }

  const unit = view?.productType === 'other' ? units[view.unit ?? 'bag'] : 'مترمربع'
  const normalized = draft.trim()
    .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace('٫', '.')
  const amount = /^\d+(?:\.\d{1,2})?$/.test(normalized) ? Number(normalized) : NaN
  const validAmount = Number.isFinite(amount) && amount >= 0 && Number.isSafeInteger(Math.round(amount * 100)) && Math.abs(amount * 100 - Math.round(amount * 100)) <= 1e-7

  return (
    <section dir="rtl" className={styles.inventory} aria-label="موجودی انبارها">
      {notice && <p role="status">{notice}</p>}
      {loading && <p>در حال دریافت موجودی…</p>}
      {!loading && !view && <button type="button" onClick={refresh}>دریافت دوباره</button>}
      {!loading && view && !view.rows.length && <p>هنوز انباری ثبت نشده است.</p>}
      {!loading && view && view.rows.map(row => {
        const { warehouse, balance } = row
        const exact = warehouse.stockMode === 'exact'
        const canEdit = view.canEdit && warehouse.isActive && (!balance || (exact && balance.isActive))
        const current = balance?.amount ?? null
        const editingRow = editing === warehouse.id
        return (
          <article key={warehouse.id} className={styles.warehouse}>
            <div>
              <h3>{warehouse.name}</h3>
              <p>{exact ? 'قطعی' : 'استعلامی'} · {warehouse.isActive ? 'انبار فعال' : 'انبار غیرفعال'}</p>
            </div>
            <div>
              <p>{!balance ? 'بدون رکورد' : balance.isActive ? 'ردیف فعال' : 'ردیف غیرفعال'}</p>
              {exact && current !== null && <p>
                {number.format(current)} {unit}
                {view.productType !== 'other' && ` · ${number.format(Math.floor(Math.round(current * 100) / Math.round(view.salesFactor * 100)))} کارتن کامل`}
              </p>}
              {!exact && balance && <p>آخرین گزارش {balance.lastReportedAt ? date.format(new Date(balance.lastReportedAt)) : 'ثبت نشده'}</p>}
            </div>
            {canEdit && (editingRow ? (
              <div className={styles.controls}>
                {exact && <label>
                  موجودی جدید ({unit})
                  <input
                    dir="ltr" inputMode="decimal" value={draft} disabled={busy}
                    onChange={event => setDraft(event.target.value)}
                    onKeyDown={event => { if (event.key === 'Enter') event.preventDefault() }}
                  />
                </label>}
                {!exact && <p>حضور محصول در این انبار ثبت می‌شود.</p>}
                {exact && validAmount && <p>قبل: {current === null ? 'بدون رکورد' : `${number.format(current)} ${unit}`} · بعد: {number.format(amount)} {unit}</p>}
                <div className={styles.actions}>
                  <button type="button" disabled={busy || (exact && (!validAmount || amount === current))} onClick={() => void save(row, exact ? amount : null)}>تأیید و ثبت موجودی</button>
                  <button type="button" disabled={busy} onClick={() => setEditing(undefined)}>انصراف</button>
                </div>
              </div>
            ) : (
              <button type="button" disabled={busy} onClick={() => {
                setEditing(warehouse.id)
                setDraft(current === null ? '' : String(current))
              }}>{balance ? 'اصلاح موجودی' : 'افزودن به انبار'}</button>
            ))}
          </article>
        )
      })}
    </section>
  )
}
