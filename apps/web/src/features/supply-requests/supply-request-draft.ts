import { useSyncExternalStore } from 'react'
import { saveDraft } from '../../lib/drafts'
import { toast } from '../../components/feedback/toast'

export interface SupplyDraft {
  productId: number
  warehouseId: number | null
  requestedQuantity: number
  notes: string
  submissionKey: string
  pending?: boolean
}
interface SupplyDraftState { owner: string; draft: SupplyDraft | null; persisted: boolean }
let state: SupplyDraftState = { owner: '', draft: null, persisted: true }
const listeners = new Set<() => void>()
const storageKey = (owner: string) => `persianpart_supply_draft_v1:${owner}`
const emit = () => listeners.forEach(listener => listener())
const valid = (value: unknown): value is SupplyDraft => {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  return Number.isSafeInteger(data.productId) && Number(data.productId) > 0 && (data.warehouseId === null || (Number.isSafeInteger(data.warehouseId) && Number(data.warehouseId) > 0)) && typeof data.requestedQuantity === 'number' && Number.isFinite(data.requestedQuantity) && typeof data.notes === 'string' && typeof data.submissionKey === 'string' && /^[0-9a-f-]{36}$/i.test(data.submissionKey) && (data.pending === undefined || typeof data.pending === 'boolean')
}
const persist = () => {
  if (!state.owner) return true
  if (state.draft) return saveDraft(storageKey(state.owner), state.draft)
  try { localStorage.removeItem(storageKey(state.owner)); return true } catch { return false }
}
export const supplyDraftStore = {
  subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener) },
  getSnapshot: () => state,
  setOwner(owner: string) {
    if (owner === state.owner) return
    let draft: SupplyDraft | null = null
    if (owner) {
      try { const saved: unknown = JSON.parse(localStorage.getItem(storageKey(owner)) ?? 'null'); if (valid(saved)) draft = saved } catch { /* Invalid storage is ignored. */ }
    }
    state = { owner, draft, persisted: true }; emit()
  },
  open(productId: number) {
    if (!state.owner) return false
    if (state.draft?.pending && state.draft.productId !== productId) { toast.warning('ثبت نامطمئن', 'ابتدا نتیجه درخواست قبلی را پیگیری کنید.'); return false }
    if (state.draft && state.draft.productId !== productId && !window.confirm('پیش‌نویس قبلی جایگزین شود؟')) return false
    if (state.draft?.productId !== productId) {
      state = { ...state, draft: { productId, warehouseId: null, requestedQuantity: 1, notes: '', submissionKey: crypto.randomUUID() } }
      state = { ...state, persisted: persist() }; emit()
    }
    return true
  },
  update(change: Partial<Pick<SupplyDraft, 'warehouseId' | 'requestedQuantity' | 'notes'>>) {
    const draft = state.draft
    if (!draft) return false
    if (draft.pending) return false
    if (change.warehouseId != null && draft.warehouseId != null && change.warehouseId !== draft.warehouseId && !window.confirm('انبار پیش‌نویس تغییر کند؟')) return false
    const next = { ...draft, ...change }
    if (next.warehouseId === draft.warehouseId && next.requestedQuantity === draft.requestedQuantity && next.notes === draft.notes) return true
    if (next.warehouseId !== draft.warehouseId || next.requestedQuantity !== draft.requestedQuantity || next.notes.trim() !== draft.notes.trim()) next.submissionKey = crypto.randomUUID()
    state = { ...state, draft: next }; state = { ...state, persisted: persist() }; emit(); return true
  },
  retryPersist() { state = { ...state, persisted: persist() }; emit() },
  markPending(owner: string, key: string) {
    if (state.owner !== owner || state.draft?.submissionKey !== key || !state.draft.warehouseId) return false
    state = { ...state, draft: { ...state.draft, pending: true } }
    const persisted = persist()
    state = { ...state, persisted }; emit()
    return persisted
  },
  clearPending(owner: string, key: string) {
    if (state.owner !== owner || state.draft?.submissionKey !== key) return
    state = { ...state, draft: { ...state.draft, pending: false } }
    state = { ...state, persisted: persist() }; emit()
  },
  clearIfCurrent(owner: string, key: string) {
    if (state.owner !== owner || state.draft?.submissionKey !== key) return
    state = { ...state, draft: null }; state = { ...state, persisted: persist() }; emit()
  },
}
export const useSupplyDraft = () => useSyncExternalStore(supplyDraftStore.subscribe, supplyDraftStore.getSnapshot, supplyDraftStore.getSnapshot)

window.addEventListener('persianpart:flush-drafts', event => {
  if (!persist() && event instanceof CustomEvent) event.detail.fail()
})
window.addEventListener('persianpart:discard-drafts', event => {
  if (event instanceof CustomEvent && event.detail === state.owner) { state = { owner: '', draft: null, persisted: true }; emit() }
})
