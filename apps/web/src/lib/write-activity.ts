import { useSyncExternalStore } from 'react'

const listeners = new Set<() => void>()
const tabId = crypto.randomUUID()
const prefix = 'persianpart_writing:'
let localCount = 0
let mutationCount = 0
let uncertainOwner = ''
function accountId() {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem('persianpart_auth') ?? 'null')
    if (saved && typeof saved === 'object' && 'user' in saved && saved.user && typeof saved.user === 'object' && 'id' in saved.user) return String(saved.user.id)
  } catch { /* No persisted account. */ }
  return ''
}
const uncertaintyKey = () => `persianpart_text_v1:${accountId()}:order-uncertain`
let cachedCount = 0
const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('persianpart-write-activity')
function refresh() {
  let total = localCount + mutationCount
  try {
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith(prefix) || key === prefix + tabId) continue
      const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null')
      if (value && typeof value === 'object' && 'at' in value && typeof value.at === 'number' && Date.now() - value.at < 35_000 && 'count' in value && typeof value.count === 'number') total += Math.max(0, value.count)
    }
  } catch { /* Same-tab safety remains available without storage. */ }
  if (total !== cachedCount) { cachedCount = total; listeners.forEach(listener => listener()) }
  return total
}
function announce() {
  try { if (localCount + mutationCount) localStorage.setItem(prefix + tabId, JSON.stringify({ count: localCount + mutationCount, at: Date.now() })); else localStorage.removeItem(prefix + tabId) } catch { /* Storage may be unavailable. */ }
  channel?.postMessage('changed')
  refresh()
}
channel?.addEventListener('message', refresh)
window.addEventListener('storage', event => { if (event.key?.startsWith(prefix)) refresh() })
window.setInterval(() => { if (localCount + mutationCount) announce(); else refresh() }, 5_000)
window.addEventListener('pagehide', () => { try { localStorage.removeItem(prefix + tabId) } catch { /* Optional cleanup. */ } })
export const writeActivity = {
  count: refresh,
  setMutationCount(count: number) { mutationCount = count; announce() },
  begin() { localCount++; announce(); let finished = false; return () => { if (!finished) { finished = true; localCount--; announce() } } },
  markUncertainOrder() { uncertainOwner = accountId(); try { localStorage.setItem(uncertaintyKey(), '1') } catch { /* Keep same-tab warning. */ } },
  hasUncertainOrder() { try { return localStorage.getItem(uncertaintyKey()) === '1' || (!!uncertainOwner && uncertainOwner === accountId()) } catch { return !!uncertainOwner && uncertainOwner === accountId() } },
  clearUncertainOrder() { uncertainOwner = ''; try { localStorage.removeItem(uncertaintyKey()) } catch { /* Optional cleanup. */ } },
}
export function useWriteActivity() {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener) }, () => cachedCount)
}
