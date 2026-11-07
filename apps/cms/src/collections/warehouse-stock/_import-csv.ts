import { parse } from 'csv-parse/sync'
import type { StockImportMode } from '@persianpart/contract'

export type CsvRow = { rowNumber: number; sku: string; inventorySqm?: number; basePricePerSqm?: number }
export type CsvError = { rowNumber: number; sku: string; message: string }

export function parseImportCsv(csv: string, mode: StockImportMode): { rows: CsvRow[]; errors: CsvError[]; total: number } {
  const records: string[][] = parse(csv, { bom: true, delimiter: mode === 'kimia' ? ';' : ',', skip_empty_lines: true, trim: true, relax_column_count: true, max_record_size: 10000 })
  if (mode !== 'kimia') {
    const headers = records.shift()
    const expected = mode === 'stock' ? ['inventorySqm', 'sku'] : ['basePricePerSqm', 'sku']
    if (!headers || headers.length !== 2 || [...headers].sort().join(',') !== expected.sort().join(',')) throw new Error(`ستون‌های فایل باید دقیقاً sku و ${expected.find(value => value !== 'sku')} باشند.`)
    if (headers[0] !== 'sku') for (const record of records) record.reverse()
  }
  if (!records.length || records.length > 1000) throw new Error('فایل باید بین یک تا هزار ردیف داشته باشد.')
  const counts = new Map<string, number>()
  for (const record of records) {
    const sku = (mode === 'kimia' ? record[4] : record[0])?.trim() ?? ''
    if (sku) counts.set(sku, (counts.get(sku) ?? 0) + 1)
  }
  const rows: CsvRow[] = []
  const errors: CsvError[] = []
  records.forEach((record, index) => {
    const rowNumber = index + (mode === 'kimia' ? 1 : 2)
    const sku = (mode === 'kimia' ? record[4] : record[0])?.trim() ?? ''
    const error = (message: string) => errors.push({ rowNumber, sku, message })
    if ((mode === 'kimia' && (record.length !== 6 || record[5] !== '')) || (mode !== 'kimia' && record.length !== 2)) { error('تعداد ستون‌های ردیف معتبر نیست.'); return }
    if (!sku) { error('کد کالا الزامی است.'); return }
    if ((counts.get(sku) ?? 0) > 1) { error('کد کالا در فایل تکراری است.'); return }
    const row: CsvRow = { rowNumber, sku }
    if (mode !== 'price') {
      const raw = mode === 'kimia' ? record[2] : record[1]
      if (!raw || !/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(raw) || Number(raw) > 1_000_000_000) { error('موجودی باید نامنفی و با حداکثر دو رقم اعشار باشد.'); return }
      row.inventorySqm = Number(raw)
    }
    if (mode !== 'stock') {
      const raw = mode === 'kimia' ? record[1] : record[1]
      if (!raw || !/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw))) { error('قیمت باید عدد صحیح و نامنفی باشد.'); return }
      row.basePricePerSqm = mode === 'kimia' ? Math.round(Number(raw) / 10) : Number(raw)
    }
    rows.push(row)
  })
  return { rows, errors, total: records.length }
}
