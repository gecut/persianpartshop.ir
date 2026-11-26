import { describe, expect, test } from 'bun:test'
import { formatInvoiceDateTime, formatInvoiceQuantity, invoiceValidUntil, tomanToPersianWords } from './_invoice-format'

describe('formatInvoiceQuantity', () => {
  test('uses Persian decimal separator', () => expect(formatInvoiceQuantity(40.32)).toBe('۴۰٫۳۲'))
  test('integers have no decimals', () => expect(formatInvoiceQuantity(12)).toBe('۱۲'))
  test('groups thousands', () => expect(formatInvoiceQuantity(1234.5)).toBe('۱٬۲۳۴٫۵'))
  test('rounds to 2 decimals', () => expect(formatInvoiceQuantity(2.456)).toBe('۲٫۴۶'))
})

describe('formatInvoiceDateTime', () => {
  test('Jalali, Tehran time, Persian comma', () =>
    expect(formatInvoiceDateTime('2026-11-24T09:42:00.000Z')).toBe('۱۴۰۵/۰۹/۰۳، ۱۳:۱۲'))
  test('returns em-dash for invalid date', () =>
    expect(formatInvoiceDateTime('not-a-date')).toBe('—'))
})

describe('invoiceValidUntil', () => {
  test('adds 24 hours', () =>
    expect(invoiceValidUntil('2026-11-24T09:42:00.000Z').toISOString()).toBe('2026-11-25T09:42:00.000Z'))
})

describe('tomanToPersianWords', () => {
  test('zero', () => expect(tomanToPersianWords(0)).toBe('صفر تومان'))
  test('teens', () => expect(tomanToPersianWords(15)).toBe('پانزده تومان'))
  test('hundreds', () => expect(tomanToPersianWords(320)).toBe('سیصد و بیست تومان'))
  test('sample total', () =>
    expect(tomanToPersianWords(42_032_600)).toBe('چهل و دو میلیون و سی و دو هزار و ششصد تومان'))
  test('billions', () =>
    expect(tomanToPersianWords(1_500_000_000)).toBe('یک میلیارد و پانصد میلیون تومان'))
  test('rejects negatives and non-integers', () => {
    expect(() => tomanToPersianWords(-1)).toThrow()
    expect(() => tomanToPersianWords(1.5)).toThrow()
  })
})
