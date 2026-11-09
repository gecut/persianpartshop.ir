import { clearAccountDrafts } from '../../lib/drafts'
import { writeActivity } from '../../lib/write-activity'
import { isSessionError } from '../../lib/session-error'
import { selectionStore } from '../products/selection-store'
import { useState, useEffect } from 'react'
import { api, setAuthErrorHandler } from '../../lib/api-client'
import { clearTanStackCache, queryClient } from '../../lib/query-client'

export interface UserProfile {
  id: string
  name: string
  storeName: string
  phone: string
  province: string
  city: string
  address: string
  economicCode: string
  hideExactStock?: boolean
  disableOrdering?: boolean
  canUseProductQr?: boolean
  allowedCategories?: any[]
  allowedCategoryIds?: number[]
}

export function parseAllowedCategories(raw: any): {
  allowedCategories: any[]
  allowedCategoryIds: number[]
} {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { allowedCategories: [], allowedCategoryIds: [] }
  }
  const allowedCategories = raw
  const allowedCategoryIds = raw
    .map((c: any) => (typeof c === 'object' && c !== null ? c.id : c))
    .map(Number)
    .filter((n: number) => !isNaN(n) && n > 0)
  return { allowedCategories, allowedCategoryIds }
}

export function isCategoryAllowedForUser(
  categoryOrId: any,
  user?: UserProfile | null
): boolean {
  if (!user) return true
  const allowed = user.allowedCategoryIds
  // If user has no category restrictions (empty or undefined), all categories are permitted
  if (!allowed || !Array.isArray(allowed) || allowed.length === 0) {
    return true
  }

  let catId: number | null = null
  let catSlug: string | null = null
  let catName: string | null = null

  if (typeof categoryOrId === 'object' && categoryOrId !== null) {
    if (categoryOrId.id != null) catId = Number(categoryOrId.id)
    if (categoryOrId.slug) catSlug = String(categoryOrId.slug)
    if (categoryOrId.name) catName = String(categoryOrId.name)
    if (categoryOrId.title) catName = String(categoryOrId.title)
  } else if (typeof categoryOrId === 'number') {
    catId = categoryOrId
  } else if (typeof categoryOrId === 'string') {
    const parsed = Number(categoryOrId)
    if (!isNaN(parsed) && parsed > 0) {
      catId = parsed
    } else {
      catSlug = categoryOrId
    }
  }

  if (catId != null && !isNaN(catId) && catId > 0) {
    return allowed.includes(catId)
  }

  if (Array.isArray(user.allowedCategories) && user.allowedCategories.length > 0) {
    for (const c of user.allowedCategories) {
      if (typeof c === 'object' && c !== null) {
        if (catSlug && c.slug === catSlug) return true
        if (catName && (c.name === catName || c.title === catName)) return true
        if (catId && Number(c.id) === catId) return true
      }
    }
  }

  return false
}

export function isProductAllowedForUser(
  productOrDoc: any,
  user?: UserProfile | null
): boolean {
  if (!user) return true
  const allowed = user.allowedCategoryIds
  // If user has no category restrictions, product is permitted
  if (!allowed || !Array.isArray(allowed) || allowed.length === 0) {
    return true
  }

  if (!productOrDoc) return false

  const rawCat =
    productOrDoc.categoryId ??
    productOrDoc.category ??
    productOrDoc.category_id

  return isCategoryAllowedForUser(rawCat, user)
}

interface AuthState {
  isAuthenticated: boolean
  user: UserProfile | null
  pendingPhone: string | null
}

const STORAGE_KEY = 'persianpart_auth'
const TOKEN_KEY = 'persianpart_token'

function getInitialState(): AuthState {
  if (typeof window === 'undefined') {
    return { isAuthenticated: false, user: null, pendingPhone: null }
  }
  try {
    const token = localStorage.getItem(TOKEN_KEY)
    const saved = localStorage.getItem(STORAGE_KEY)
    if (token && saved) {
      const parsed = JSON.parse(saved)
      if (parsed.user && parsed.user.hideExactStock) {
        parsed.user.disableOrdering = true
      }
      return { isAuthenticated: true, user: parsed.user || null, pendingPhone: null }
    }
  } catch {
    // fallback
  }
  return { isAuthenticated: false, user: null, pendingPhone: null }
}

let currentState: AuthState = getInitialState()
const listeners = new Set<(state: AuthState) => void>()

function broadcast(nextState: AuthState) {
  currentState = nextState
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState))
    } catch {
      // ignore
    }
  }
  listeners.forEach((listener) => listener(currentState))
}

export const authStore = {
  getState: () => currentState,

  sendOtp: async (phone: string): Promise<string | boolean> => {
    try {
      const res = await api.auth.requestOtp({ phone })
      broadcast({ ...currentState, pendingPhone: phone })
      return res.message || true
    } catch (err: any) {
      throw new Error(err.message || 'خطا در ارسال کد اعتبارسنجی')
    }
  },

  verifyOtp: async (code: string): Promise<boolean> => {
    const mobile = currentState.pendingPhone
    if (!mobile) {
      throw new Error('شماره موبایل ثبت نشده است. لطفاً ابتدا شماره را وارد کنید.')
    }

    try {
      const res = await api.auth.verifyOtp({ phone: mobile, code })
      if (typeof window !== 'undefined') {
        localStorage.setItem(TOKEN_KEY, res.token)
      }

      const userData = (res.user || (res as any).customer || {}) as any
      const hideExactStock = Boolean(userData.hideExactStock)
      const disableOrdering = Boolean(userData.disableOrdering) || hideExactStock
      const { allowedCategories, allowedCategoryIds } = parseAllowedCategories(
        userData.allowedCategories || (res as any).customer?.allowedCategories
      )
      const userProfile: UserProfile = {
        id: String(userData.id || 'user-1'),
        name: userData.fullName || userData.contactName || 'کاربر گرامی',
        storeName: userData.companyName || userData.storeName || 'فروشگاه قطعات',
        phone: userData.phone || userData.mobile || mobile,
        province: userData.province || 'تهران',
        city: userData.city || 'تهران',
        address: userData.address || '',
        economicCode: '',
        hideExactStock,
        disableOrdering,
        canUseProductQr: Boolean(userData.canUseProductQr),
        allowedCategories,
        allowedCategoryIds,
      }

      clearTanStackCache()
      window.dispatchEvent(new Event('persianpart:account-change'))
      window.dispatchEvent(new Event('persianpart:login-success'))
      broadcast({
        isAuthenticated: true,
        user: userProfile,
        pendingPhone: null,
      })
      queryClient.setQueryData(queryKeys.auth.session(userProfile.id), { user: userData })
      return true
    } catch (err: any) {
      throw new Error(err.message || 'کد وارد شده اشتباه یا منقضی است.')
    }
  },

  logout: (explicit = false) => {
    if (!currentState.isAuthenticated) return true
    if (explicit && writeActivity.count()) return false
    if (explicit && writeActivity.hasUncertainOrder() && !window.confirm('ممکن است سفارش شما ثبت شده باشد. با خروج، پیش‌نویس حذف می‌شود؛ پیش از ثبت دوباره سفارش‌ها را بررسی کنید. ادامه می‌دهید؟')) return false
    if (explicit && currentState.user) {
      try { localStorage.setItem('persianpart_explicit_logout', JSON.stringify({ owner: String(currentState.user.id), at: Date.now() })) } catch { /* Same-tab deletion remains available. */ }
      selectionStore.clearSelection()
      clearAccountDrafts(String(currentState.user.id))
      writeActivity.clearUncertainOrder()
    }
    selectionStore.setOwner('')
    try {
      void api.auth.logout().catch(() => {})
    } catch {
      // Best effort
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem('persianpart_orders_v2')
    }
    clearTanStackCache()
    broadcast({
      isAuthenticated: false,
      user: null,
      pendingPhone: null,
    })
    window.dispatchEvent(new Event('persianpart:account-change'))
    return true
  },

  updateProfile: async (updated: Partial<UserProfile>) => {
    if (!currentState.user) return

    const expectedUser = currentState.user.id
    const profile = await api.user.update({ fullName: updated.name, companyName: updated.storeName, address: updated.address })
    if (currentState.user?.id !== expectedUser) throw new Error('حساب کاربری تغییر کرده است.')
    broadcast({ ...currentState, user: { ...currentState.user, ...updated } })
    queryClient.setQueryData(queryKeys.auth.profile(expectedUser), profile)
    return profile
  },

  acceptProfile: (profile: unknown) => {
    if (!profile || typeof profile !== 'object' || !('id' in profile) || !currentState.user || String(profile.id) !== currentState.user.id) return
    const raw: Record<string, unknown> = Object.fromEntries(Object.entries(profile))
    const previous = currentState.user
    const text = (key: string, fallback: string) => typeof raw[key] === 'string' ? raw[key] : fallback
    const categories = 'allowedCategories' in raw ? parseAllowedCategories(raw.allowedCategories) : { allowedCategories: previous.allowedCategories, allowedCategoryIds: previous.allowedCategoryIds }
    const user: UserProfile = { ...previous, name: text('fullName', previous.name), storeName: text('companyName', previous.storeName), phone: text('phone', previous.phone), province: text('province', previous.province), city: text('city', previous.city), address: text('address', previous.address), economicCode: text('economicCode', previous.economicCode), ...categories,
      hideExactStock: 'hideExactStock' in raw ? Boolean(raw.hideExactStock) : previous.hideExactStock,
      disableOrdering: 'disableOrdering' in raw ? Boolean(raw.disableOrdering) || Boolean(raw.hideExactStock) : previous.disableOrdering,
      canUseProductQr: 'canUseProductQr' in raw ? Boolean(raw.canUseProductQr) : previous.canUseProductQr,
    }
    if (JSON.stringify(user) !== JSON.stringify(previous)) broadcast({ ...currentState, user })
  },

}

setAuthErrorHandler((error: unknown) => {
  if (isSessionError(error)) authStore.logout()
})

window.addEventListener('storage', event => {
  if (event.key === 'persianpart_explicit_logout') {
    try {
      const data: unknown = JSON.parse(event.newValue ?? 'null')
      if (data && typeof data === 'object' && 'owner' in data && typeof data.owner === 'string') window.dispatchEvent(new CustomEvent('persianpart:discard-drafts', { detail: data.owner }))
    } catch { /* Ignore malformed cross-tab messages. */ }
    return
  }
  if (event.key !== STORAGE_KEY && event.key !== TOKEN_KEY) return
  clearTanStackCache()
  selectionStore.setOwner('')
  currentState = getInitialState()
  listeners.forEach(listener => listener(currentState))
  window.dispatchEvent(new Event('persianpart:account-change'))
})

import { useMutation } from '@tanstack/react-query'
import { queryKeys, mutationKeys } from '../../lib/query-keys'

export function useAuth() {
  const [state, setState] = useState<AuthState>(authStore.getState())

  useEffect(() => {
    listeners.add(setState)
    return () => {
      listeners.delete(setState)
    }
  }, [])

  const sendOtpMutation = useMutation({
    mutationKey: mutationKeys.auth.requestOtp,
    mutationFn: (phone: string) => authStore.sendOtp(phone),
  })

  const verifyOtpMutation = useMutation({
    mutationKey: mutationKeys.auth.verifyOtp,
    mutationFn: (code: string) => authStore.verifyOtp(code),

  })

  const updateProfileMutation = useMutation({
    mutationKey: mutationKeys.auth.updateProfile,
    mutationFn: (updated: Partial<UserProfile>) => authStore.updateProfile(updated),

  })

  return {
    ...state,
    sendOtp: (phone: string) => sendOtpMutation.mutateAsync(phone),
    verifyOtp: (code: string) => verifyOtpMutation.mutateAsync(code),
    logout: () => authStore.logout(true),
    updateProfile: (updated: Partial<UserProfile>) => updateProfileMutation.mutateAsync(updated),
  }
}
