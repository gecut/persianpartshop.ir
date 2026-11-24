export const galleryQueueTimeoutMs = 10_000

/**
 * Sequential background loading state for one open gallery.
 * `scope` identifies the open gallery (product + open state); events from another scope are dropped.
 */
export interface GalleryQueueState {
  scope: string
  started: ReadonlySet<string>
  timedOut: ReadonlySet<string>
}

export function emptyGalleryQueue(scope: string): GalleryQueueState {
  return { scope, started: new Set(), timedOut: new Set() }
}

function within(state: GalleryQueueState, scope: string) {
  return state.scope === scope ? state : emptyGalleryQueue(scope)
}

export function startUrls(state: GalleryQueueState, scope: string, urls: readonly string[]): GalleryQueueState {
  const current = within(state, scope)
  if (urls.every(url => current.started.has(url))) return current
  return { ...current, started: new Set([...current.started, ...urls]) }
}

/** A late timer or event from a previous scope returns the state unchanged. */
export function markTimedOut(state: GalleryQueueState, scope: string, url: string): GalleryQueueState {
  if (state.scope !== scope || state.timedOut.has(url)) return state
  return { ...state, timedOut: new Set([...state.timedOut, url]) }
}

export function pendingUrls(order: readonly string[], state: GalleryQueueState, isDone: (url: string) => boolean) {
  return order.filter(url => state.started.has(url) && !state.timedOut.has(url) && !isDone(url))
}

/**
 * The next background url, or null while any started request is still undecided.
 * A decided request is one that loaded, failed for good, or timed out.
 */
export function nextBackgroundUrl(order: readonly string[], state: GalleryQueueState, isDone: (url: string) => boolean) {
  if (pendingUrls(order, state, isDone).length) return null
  return order.find(url => !state.started.has(url) && !isDone(url)) ?? null
}
