import { useEffect, useRef, useState, type SetStateAction } from 'react'
import { toast } from '@/components/feedback/toast'

const prefix = 'persianpart_text_v1:'
export function saveDraft(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true }
  catch { toast.warning('پیش‌نویس ذخیره نشد', 'فضای ذخیره‌سازی در دسترس نیست؛ پیش از بستن برنامه دوباره تلاش کنید.'); return false }
}
export function clearAccountDrafts(owner: string) {
  window.dispatchEvent(new CustomEvent('persianpart:discard-drafts', { detail: owner }))
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(`${prefix}${owner}:`) || key === `persianpart_draft_v3:${owner}` || key === `persianpart_draft_v3:${owner}:submission` || key === `persianpart_supply_draft_v1:${owner}`) localStorage.removeItem(key)
  }
}
export function flushDrafts() {
  let success = true
  window.dispatchEvent(new CustomEvent('persianpart:flush-drafts', { detail: { fail: () => { success = false } } }))
  return success
}
export function useTextDraft<T extends string | Record<string, string>>(owner: string, name: string, initial: T) {
  const key = `${prefix}${owner}:${name}`
  const [value, setValue] = useState<T>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(key) ?? 'null')
      if (typeof initial === 'string' && typeof saved === 'string') return saved as T
      if (typeof initial === 'object' && saved && typeof saved === 'object' && Object.keys(initial).every(field => field in saved && typeof Reflect.get(saved, field) === 'string')) return saved as T
    } catch { /* Invalid drafts do not replace the current form. */ }
    return initial
  })
  const latest = useRef(value)
  const dirty = useRef(false)
  const removed = useRef(false)
  useEffect(() => {
    const persist = () => !owner || !dirty.current || removed.current || saveDraft(key, latest.current)
    const flush = (event: Event) => { if (!persist() && event instanceof CustomEvent) event.detail.fail() }
    const discard = (event: Event) => { if (event instanceof CustomEvent && event.detail === owner) { removed.current = true; dirty.current = false } }
    const storage = (event: StorageEvent) => { if (event.key === key && event.newValue === null) { removed.current = true; dirty.current = false } }
    window.addEventListener('storage', storage)
    window.addEventListener('persianpart:discard-drafts', discard)
    const hidden = () => { if (document.visibilityState === 'hidden') persist() }
    window.addEventListener('persianpart:flush-drafts', flush)
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('pagehide', persist)
    window.addEventListener('focusout', persist)
    return () => { persist(); window.removeEventListener('storage', storage); window.removeEventListener('persianpart:discard-drafts', discard); window.removeEventListener('persianpart:flush-drafts', flush); document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', persist); window.removeEventListener('focusout', persist) }
  }, [key, owner])
  useEffect(() => {
    if (!dirty.current || removed.current) return
    const timer = window.setTimeout(() => { if (!removed.current) saveDraft(key, value) }, 300)
    return () => window.clearTimeout(timer)
  }, [key, value])
  const update = (next: SetStateAction<T>) => {
    const result = typeof next === 'function' ? next(latest.current) : next
    latest.current = result; removed.current = false; dirty.current = true; setValue(result)
  }
  const discard = () => { removed.current = true; dirty.current = false; localStorage.removeItem(key) }
  return [value, update, discard] as const
}
