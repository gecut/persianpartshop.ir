import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type CustomerProfile } from '../lib/api-client'
import { queryKeys, mutationKeys } from '../lib/query-keys'

export function useAuth() {
  const queryClient = useQueryClient()
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('persianpart_token')
    }
    return null
  })

  const { data: customer, isLoading } = useQuery({
    queryKey: queryKeys.auth.session(token),
    queryFn: async () => {
      const currentToken = typeof window !== 'undefined' ? localStorage.getItem('persianpart_token') : null
      if (!currentToken) {
        return null
      }
      try {
        const custProfile = await api.auth.customer.me()
        return custProfile as CustomerProfile
      } catch {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('persianpart_token')
        }
        setToken(null)
        return null
      }
    },
    staleTime: 5 * 60 * 1000,
  })

  const requestOtpMutation = useMutation({
    mutationKey: mutationKeys.auth.requestOtp,
    mutationFn: async (mobile: string) => {
      return await api.auth.customer.requestOtp({ mobile })
    },
  })

  const verifyOtpMutation = useMutation({
    mutationKey: mutationKeys.auth.verifyOtp,
    mutationFn: async ({ mobile, code }: { mobile: string; code: string }) => {
      const res = await api.auth.customer.verifyOtp({ mobile, code })
      if (typeof window !== 'undefined') {
        localStorage.setItem('persianpart_token', res.token)
      }
      setToken(res.token)
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.all })
      return res
    },
  })

  const logout = async () => {
    try {
      await api.auth.logout()
    } catch {}
    if (typeof window !== 'undefined') {
      localStorage.removeItem('persianpart_token')
    }
    setToken(null)
    queryClient.invalidateQueries({ queryKey: queryKeys.auth.all })
  }

  return {
    token,
    customer,
    isAuthenticated: !!token && !!customer,
    isLoading,
    error: requestOtpMutation.error
      ? (requestOtpMutation.error as Error).message
      : verifyOtpMutation.error
      ? (verifyOtpMutation.error as Error).message
      : null,
    requestOtp: (mobile: string) => requestOtpMutation.mutateAsync(mobile),
    verifyOtp: (mobile: string, code: string) => verifyOtpMutation.mutateAsync({ mobile, code }),
    logout,
    refreshSession: () => queryClient.invalidateQueries({ queryKey: queryKeys.auth.all }),
  }
}
