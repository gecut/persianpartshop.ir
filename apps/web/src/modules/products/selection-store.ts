import { customerErrorMessage } from '@/lib/utils/error'
import { useSyncExternalStore } from 'react'
import type { WarehouseSummary } from '@persianpart/contract'
import { api } from '@/lib/api-client'
import { toast } from '@/components/feedback/toast'

export type DraftWarehouse = WarehouseSummary
interface QuoteItem { productType: 'tile' | 'other'; unit: string; productId: number; requestedArea: number; cartonCount: number; deliverableArea: number; unitPrice: number; totalPrice: number; sqmPerCarton: number }
interface SelectionState {
  selectedIds: string[]; quantities: Record<string, number>; warehouse: DraftWarehouse | null
  quotes: QuoteItem[]; busy: boolean; candidates: DraftWarehouse[]; error: string | null
}
export function normalizeId(id: unknown): string { return String(id ?? '').replace(/["']/g, '').trim() }
const empty = (): SelectionState => ({ selectedIds: [], quantities: {}, warehouse: null, quotes: [], busy: false, candidates: [], error: null })
let state = empty()
let owner = ''
let generation = 0
let queue = Promise.resolve()
let validating: Promise<void> | null = null
let stockController: AbortController | null = null
let choose: ((warehouse: DraftWarehouse | null) => void) | null = null
const listeners = new Set<() => void>()
const key = () => `persianpart_draft_v3:${owner}`
const emit = () => listeners.forEach(listener => listener())
function invalidateValidation() {
  generation++
  stockController?.abort()
  stockController = null
  validating = null
  choose?.(null)
  choose = null
}
function persist() {
  if (!owner) return true
  try { localStorage.setItem(key(), JSON.stringify({ version: 3, selectedIds: state.selectedIds, quantities: state.quantities, warehouse: state.warehouse })); return true }
  catch { state = { ...state, error: 'پیش‌نویس ذخیره نشد؛ فضای ذخیره‌سازی در دسترس نیست.' }; toast.warning('پیش‌نویس ذخیره نشد', state.error!); emit(); return false }
}
if (typeof window !== 'undefined') {
  window.addEventListener('persianpart:flush-drafts', event => { if (!persist() && event instanceof CustomEvent) event.detail.fail() })
}
function readSaved(value: string | null): SelectionState {
  const next = empty()
  if (!value) return next
  const parsed: unknown = JSON.parse(value)
  if (!parsed || typeof parsed !== 'object' || !('selectedIds' in parsed) || !Array.isArray(parsed.selectedIds) || !('quantities' in parsed) || !parsed.quantities || typeof parsed.quantities !== 'object') return next
  const quantities = parsed.quantities as Record<string, unknown>
  for (const rawId of parsed.selectedIds) {
    const id = normalizeId(rawId), amount = quantities[id]
    if (/^[1-9]\d*$/.test(id) && typeof amount === 'number' && Number.isFinite(amount) && amount > 0 && amount <= 1_000_000) {
      next.selectedIds.push(id); next.quantities[id] = amount
    }
  }
  next.selectedIds = [...new Set(next.selectedIds)]
  if ('warehouse' in parsed && parsed.warehouse && typeof parsed.warehouse === 'object' && 'id' in parsed.warehouse && typeof parsed.warehouse.id === 'number' && 'name' in parsed.warehouse && typeof parsed.warehouse.name === 'string' && 'code' in parsed.warehouse && typeof parsed.warehouse.code === 'string') next.warehouse = parsed.warehouse as DraftWarehouse
  return next
}
function setOwner(id: string) {
  if (owner === id) return
  invalidateValidation(); owner = id; state = empty()
  if (id) {
    try {
      const saved = localStorage.getItem(key())
      state = readSaved(saved)
      if (!saved && !localStorage.getItem('persianpart_draft_legacy_claimed')) {
        const old = readSaved(JSON.stringify({ selectedIds: JSON.parse(localStorage.getItem('persianpart_selected_products') ?? '[]'), quantities: JSON.parse(localStorage.getItem('persianpart_product_quantities') ?? '{}') }))
        const cart: unknown = JSON.parse(localStorage.getItem('persianpart_cart_v2') ?? '{}')
        if (cart && typeof cart === 'object' && 'items' in cart && Array.isArray(cart.items)) {
          for (const item of cart.items) {
            if (!item || typeof item !== 'object' || !('productId' in item) || !('requestedArea' in item)) continue
            const productId = normalizeId(item.productId), amount = item.requestedArea
            if (/^[1-9]\d*$/.test(productId) && typeof amount === 'number' && amount > 0 && amount <= 1_000_000) {
              if (old.quantities[productId] && old.quantities[productId] !== amount) old.error = 'دو مقدار قدیمی برای یک کالا یافت شد؛ مقدار بزرگ‌تر حفظ شده است. سبد را بازبینی کنید.'
              old.quantities[productId] = Math.max(old.quantities[productId] ?? 0, amount)
              old.selectedIds.push(productId)
            }
          }
        }
        old.selectedIds = [...new Set(old.selectedIds)]; state = old
        persist(); localStorage.setItem('persianpart_draft_legacy_claimed', id)
      }
    } catch { state.error = 'بازیابی سبد ذخیره‌شده ممکن نشد؛ دادهٔ قبلی حذف نشده است.' }
  }
  emit()
}
function clear() {
  try { localStorage.removeItem(`${key()}:submission`) } catch { /* Memory state remains usable. */ }
  invalidateValidation(); state = empty(); persist(); emit()
}
function update(change: (previous: SelectionState) => { selectedIds: string[]; quantities: Record<string, number> }, revalidate = false): Promise<void> {
  const expectedOwner = owner
  const enqueuedGeneration = generation
  queue = queue.then(async () => {
    if (!owner || expectedOwner !== owner || enqueuedGeneration !== generation) return
    const initialGeneration = generation
    const next = change(state)
    if (!next.selectedIds.length) { clear(); return }
    if (!navigator.onLine) {
      state = { ...state, ...next, quotes: [], busy: false, candidates: [], error: 'برای بررسی قیمت و موجودی به اینترنت وصل شوید.' }
      persist()
      emit()
      return
    }
    state = { ...state, busy: true, error: null }; emit()
    try {
      stockController = new AbortController()
      const quote = await api.warehouse.availability({ items: next.selectedIds.map(id => ({ productId: Number(id), requestedArea: next.quantities[id]! })) }, { signal: stockController.signal })
      if (initialGeneration !== generation || owner !== expectedOwner) return
      let warehouse = state.warehouse
      if (warehouse && !quote.warehouses.some(candidate => candidate.id === warehouse!.id)) {
        if (!quote.warehouses.length) throw new Error('هیچ انباری قادر به تأمین کل سبد نیست.')
        state = { ...state, candidates: quote.warehouses }; emit()
        warehouse = await new Promise<DraftWarehouse | null>(resolve => { choose = resolve })
        choose = null
        if (!warehouse || initialGeneration !== generation || owner !== expectedOwner) return
      }
      if (!warehouse) {
        if (!quote.warehouses.length) throw new Error('هیچ انباری قادر به تأمین کل سبد نیست.')
        if (quote.warehouses.length === 1) warehouse = quote.warehouses[0]!
        else {
          state = { ...state, candidates: quote.warehouses }; emit()
          warehouse = await new Promise<DraftWarehouse | null>(resolve => { choose = resolve })
          choose = null
          if (!warehouse || initialGeneration !== generation || owner !== expectedOwner) return
        }
      }
      state = { ...state, ...next, warehouse, quotes: quote.items, error: null }; persist()
    } catch (error) {
      if (initialGeneration === generation) {
        const message = customerErrorMessage(error, 'بررسی موجودی ممکن نشد؛ دوباره تلاش کنید.')
        state = { ...state, error: message, quotes: revalidate ? [] : state.quotes }
        toast.error('بررسی موجودی', message)
      }
    } finally {
      if (initialGeneration === generation) { state = { ...state, busy: false, candidates: [] }; emit() }
    }
  })
  return queue
}
export const selectionStore = {
  setOwner,
  submissionSnapshot: () => ({ owner, fingerprint: JSON.stringify([state.selectedIds, state.quantities, state.warehouse?.id]) }),
  finishSubmission: (snapshot: { owner: string; fingerprint: string }) => {
    if (owner !== snapshot.owner) return false
    if (JSON.stringify([state.selectedIds, state.quantities, state.warehouse?.id]) === snapshot.fingerprint) clear()
    return true
  },
  submissionKey: (notes = '') => {
    const fingerprint = JSON.stringify([state.warehouse?.id, state.selectedIds.map(id => [id, state.quantities[id]]).sort(), notes])
    try {
      const stored = JSON.parse(localStorage.getItem(`${key()}:submission`) ?? 'null')
      if (stored?.fingerprint === fingerprint && typeof stored.key === 'string') return stored.key as string
    } catch { /* Generate a fresh key for an invalid saved entry. */ }
    const value = crypto.randomUUID()
    try { localStorage.setItem(`${key()}:submission`, JSON.stringify({ fingerprint, key: value })) } catch { /* Browser storage may be unavailable. */ }
    return value
  },
  subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
  getSnapshot: () => state,
  chooseWarehouse: (id: number | null) => choose?.(state.candidates.find(candidate => candidate.id === id) ?? null),
  toggleProduct: (id: unknown) => state.selectedIds.includes(normalizeId(id)) ? selectionStore.unselectProduct(id) : selectionStore.selectProduct(id),
  selectProduct: (id: unknown) => selectionStore.setQuantity(id, state.quantities[normalizeId(id)] ?? 1),
  setQuantity: (id: unknown, amount: number) => {
    const cleanId = normalizeId(id)
    if (!/^[1-9]\d*$/.test(cleanId) || !Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) return Promise.resolve()
    if (!owner || state.quantities[cleanId] === amount) return Promise.resolve()
    invalidateValidation()
    state = { ...state, selectedIds: [...new Set([...state.selectedIds, cleanId])], quantities: { ...state.quantities, [cleanId]: amount }, quotes: [], candidates: [], busy: false, error: null }
    persist(); emit()
    return Promise.resolve()
  },
  setDraftQuantity: (id: unknown, amount: number) => {
    const cleanId = normalizeId(id)
    if (!owner || !state.selectedIds.includes(cleanId) || !Number.isFinite(amount) || amount <= 0 || amount > 1_000_000 || state.quantities[cleanId] === amount) return
    invalidateValidation()
    state = { ...state, quantities: { ...state.quantities, [cleanId]: amount }, quotes: [], candidates: [], busy: false, error: null }
    persist(); emit()
  },
  unselectProduct: (id: unknown) => {
    invalidateValidation()
    const cleanId = normalizeId(id), quantities = { ...state.quantities }; delete quantities[cleanId]
    const selectedIds = state.selectedIds.filter(item => item !== cleanId)
    state = { ...state, selectedIds, quantities, warehouse: selectedIds.length ? state.warehouse : null, quotes: state.quotes.filter(item => String(item.productId) !== cleanId), busy: false, candidates: [] }; persist(); emit()
  },
  setBatchSelection: (items: Array<{ id: unknown; quantity: number }>) => {
    if (state.selectedIds.length || state.busy) { toast.warning('سبد فعال', 'برای شروع سبد جدید ابتدا سبد فعلی را ثبت یا خالی کنید.'); return Promise.resolve() }
    for (const item of items) void selectionStore.setQuantity(item.id, item.quantity)
    return Promise.resolve()
  },
  reconcileWithProducts: (_ids: unknown[]) => { /* Keep unavailable legacy lines visible for explicit removal. */ },
  revalidate: () => {
    if (validating) return validating
    const pending = update(previous => ({ selectedIds: previous.selectedIds, quantities: previous.quantities }), true).finally(() => { if (validating === pending) validating = null })
    validating = pending
    return pending
  },
  clearSelection: clear,
}
if (typeof window !== 'undefined') window.addEventListener('storage', event => {
  if (owner && event.key === key()) {
    invalidateValidation()
    try { state = readSaved(event.newValue) } catch { state = empty() }
    emit()
  }
})
export function useProductSelection() {
  const snapshot = useSyncExternalStore(selectionStore.subscribe, selectionStore.getSnapshot, selectionStore.getSnapshot)
  return { ...snapshot, isProductSelected: (id: unknown) => snapshot.selectedIds.includes(normalizeId(id)), ...selectionStore, reconcileWithCatalog: selectionStore.reconcileWithProducts }
}
export function useSelectedIds() { return useSyncExternalStore(selectionStore.subscribe, () => state.selectedIds, () => state.selectedIds) }
export function useProductQuantity(id: unknown) { return useSyncExternalStore(selectionStore.subscribe, () => state.quantities[normalizeId(id)], () => undefined) }
export function useAllQuantities() { return useSyncExternalStore(selectionStore.subscribe, () => state.quantities, () => state.quantities) }

export async function prepareReorderDraft(items: Array<{ productId: string; requestedArea: number; deliverableArea: number }>): Promise<boolean> {
  if (state.selectedIds.length || state.busy) {
    toast.warning('سبد فعال', 'برای سفارش مجدد ابتدا سبد فعلی را ثبت یا خالی کنید.')
    return false
  }
  await selectionStore.setBatchSelection(items.map(item => ({ id: item.productId, quantity: item.requestedArea || item.deliverableArea })))
  await selectionStore.revalidate()
  return Boolean(state.warehouse && !state.error && state.selectedIds.length === items.length && items.every(item => state.quantities[item.productId] === (item.requestedArea || item.deliverableArea)))
}
