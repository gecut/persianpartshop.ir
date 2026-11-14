import { useSyncExternalStore } from 'react'

type ReadSource = 'online' | 'saved'

export const offlineRecoveryEnabled = import.meta.env.VITE_OFFLINE_RECOVERY === 'true'

let source: ReadSource = 'online'
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function selectReadSource(next: ReadSource) {
  if (!offlineRecoveryEnabled || source === next) return
  navigator.serviceWorker?.controller?.postMessage({ type: 'OFFLINE_READ_SOURCE', saved: next === 'saved' })
  source = next
  for (const listener of listeners) listener()
}

export function readsFromNetwork() {
  return offlineRecoveryEnabled ? source === 'online' : navigator.onLine
}

export function useNetworkReadSource() {
  return useSyncExternalStore(offlineRecoveryEnabled ? subscribe : subscribeToConnectivity, readsFromNetwork)
}

function subscribeToConnectivity(listener: () => void) {
  window.addEventListener('online', listener)
  window.addEventListener('offline', listener)
  return () => {
    window.removeEventListener('online', listener)
    window.removeEventListener('offline', listener)
  }
}

window.addEventListener('persianpart:account-change', () => selectReadSource('online'))

navigator.serviceWorker?.addEventListener('controllerchange', () => {
  if (offlineRecoveryEnabled) navigator.serviceWorker.controller?.postMessage({ type: 'OFFLINE_READ_SOURCE', saved: source === 'saved' })
})
