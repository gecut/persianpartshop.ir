import { useState, useEffect } from 'react'
import { api, setAuthErrorHandler } from '../../lib/api-client'
import { toast } from '../../components/feedback/toast'
import { clearTanStackCache } from '../../lib/query-client'

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
      const userProfile: UserProfile = {
        id: String(userData.id || 'user-1'),
        name: userData.fullName || userData.contactName || 'کاربر گرامی',
        storeName: userData.storeName || 'فروشگاه قطعات',
        phone: userData.phone || userData.mobile || mobile,
        province: userData.province || 'تهران',
        city: userData.city || 'تهران',
        address: userData.address || '',
        economicCode: '',
        hideExactStock,
        disableOrdering,
      }

      broadcast({
        isAuthenticated: true,
        user: userProfile,
        pendingPhone: null,
      })
      return true
    } catch (err: any) {
      throw new Error(err.message || 'کد وارد شده اشتباه یا منقضی است.')
    }
  },

  logout: () => {
    try {
      api.auth.logout()
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
  },

  updateProfile: async (updated: Partial<UserProfile>) => {
    if (!currentState.user) return

    try {
      await api.user.update({
        fullName: updated.name,
        address: updated.address,
      })
    } catch {
      // Best effort update
    }

    broadcast({
      ...currentState,
      user: { ...currentState.user, ...updated },
    })
  },

  syncProfile: async () => {
    if (typeof window === 'undefined') return
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) return

    try {
      const profile: any = await api.user.profile()
      if (profile) {
        const hideExactStock = Boolean(profile.hideExactStock)
        const disableOrdering = Boolean(profile.disableOrdering) || hideExactStock
        const userProfile: UserProfile = {
          id: String(profile.id),
          name: profile.fullName || profile.name || 'کاربر گرامی',
          storeName: profile.companyName || 'فروشگاه قطعات',
          phone: profile.phone || '',
          province: profile.province || 'تهران',
          city: profile.city || 'تهران',
          address: profile.address || '',
          economicCode: profile.economicCode || '',
          hideExactStock,
          disableOrdering,
        }
        broadcast({
          isAuthenticated: true,
          user: userProfile,
          pendingPhone: null,
        })
      }
    } catch {
      // Best effort sync
    }
  },
}

setAuthErrorHandler((err) => {
  const msg = err?.message || err?.error?.message || ''
  const isBanned =
    (err?.data?.code === 'USER_BANNED' ||
      err?.error?.data?.code === 'USER_BANNED' ||
      msg.includes('توسط مدیریت مسدود') ||
      msg.includes('مسدود گردید')) &&
    !msg.includes('کاتالوگ') &&
    !msg.includes('دسته‌بندی') &&
    !msg.includes('مدیران سیستم')

  const isUnauthorized =
    err?.code === 'UNAUTHORIZED' ||
    err?.error?.code === 'UNAUTHORIZED' ||
    err?.status === 401 ||
    msg.includes('وارد حساب کاربری')

  if (isBanned) {
    authStore.logout()
    toast.error('مسدود شدن حساب کاربری', msg || 'حساب کاربری شما توسط مدیریت مسدود گردید.')
  } else if (isUnauthorized) {
    authStore.logout()
  }
})

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys, mutationKeys } from '../../lib/query-keys'

export function useAuth() {
  const queryClient = useQueryClient()
  const [state, setState] = useState<AuthState>(authStore.getState())

  useEffect(() => {
    listeners.add(setState)
    if (state.isAuthenticated) {
      authStore.syncProfile()
    }
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.all })
    },
  })

  const updateProfileMutation = useMutation({
    mutationKey: mutationKeys.auth.updateProfile,
    mutationFn: (updated: Partial<UserProfile>) => authStore.updateProfile(updated),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.all })
    },
  })

  return {
    ...state,
    sendOtp: (phone: string) => sendOtpMutation.mutateAsync(phone),
    verifyOtp: (code: string) => verifyOtpMutation.mutateAsync(code),
    logout: () => {
      authStore.logout()
      clearTanStackCache()
    },
    updateProfile: (updated: Partial<UserProfile>) => updateProfileMutation.mutateAsync(updated),
  }
}
