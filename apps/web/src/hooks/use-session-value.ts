import { useEffect, useState } from 'react'
import { authStore } from '../features/auth/auth-store'

export function useSessionValue<T extends string | number>(name: string, initial: T) {
  const key = `persianpart_view:${authStore.getState().user?.id ?? 'guest'}:${name}`
  const [value, setValue] = useState<T>(() => {
    try {
      const saved: unknown = JSON.parse(sessionStorage.getItem(key) ?? 'null')
      if (typeof saved === typeof initial && (typeof saved !== 'number' || Number.isFinite(saved) && saved >= 0)) return saved as T
    } catch { /* Optional view state. */ }
    return initial
  })
  useEffect(() => {
    try { sessionStorage.setItem(key, JSON.stringify(value)) } catch { /* Optional view state. */ }
  }, [key, value])
  return [value, setValue] as const
}
