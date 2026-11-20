import { beforeAll, describe, expect, test } from 'bun:test'

const store = new Map<string, string>()
const target = new EventTarget()
beforeAll(() => {
  Object.assign(globalThis, {
    window: Object.assign(target, {
      location: { origin: 'http://localhost', href: 'http://localhost/' },
      confirm: () => true,
      setInterval: (run: () => void, ms: number) => { const timer = setInterval(run, ms); timer.unref?.(); return timer },
      clearInterval,
      setTimeout,
      clearTimeout,
    }),
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value) },
      removeItem: (key: string) => { store.delete(key) },
      key: (index: number) => [...store.keys()][index] ?? null,
      get length() { return store.size },
    },
  })
})

describe('auth session end', () => {
  test('notifies listeners and lets them unsubscribe', async () => {
    const { onSessionEnd } = await import('./auth-store')
    const events: boolean[] = []
    const stop = onSessionEnd(({ discardDrafts }) => { events.push(discardDrafts) })
    target.dispatchEvent(Object.assign(new Event('storage'), { key: 'persianpart_token', newValue: null }))
    stop()
    target.dispatchEvent(Object.assign(new Event('storage'), { key: 'persianpart_token', newValue: null }))
    expect(events).toEqual([false])
  })
})
