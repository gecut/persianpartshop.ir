import { useEffect } from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { authStore, useAuth } from '@/modules/auth/auth-store'
import { catalogCoordinator } from '@/modules/products/catalog-data'
import { selectionStore } from '@/modules/products/selection-store'
import { supplyDraftStore } from '@/modules/supply-requests/supply-request-draft'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'

export function useSessionSync(isLoginPage: boolean) {
  const { isAuthenticated, user } = useAuth()
  const routerState = useRouterState()
  const navigate = useNavigate()

  useEffect(() => { selectionStore.setOwner(isAuthenticated && user ? String(user.id) : '') }, [isAuthenticated, user?.id])
  useEffect(() => { supplyDraftStore.setOwner(isAuthenticated && user ? String(user.id) : '') }, [isAuthenticated, user?.id])

  // One shared session check; no periodic polling.
  const { data: sessionData, error: sessionError, refetch: refetchSession } = useQuery({
    queryKey: queryKeys.auth.session(user?.id),
    queryFn: async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('persianpart_token') : null
      if (!token) return null
      return api.auth.session()
    },
    enabled: isAuthenticated && !isLoginPage,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    retry: false,
  })

  useEffect(() => {
    if (!isAuthenticated || isLoginPage) return

    if (sessionError && typeof sessionError === 'object' && 'code' in sessionError && sessionError.code === 'FORBIDDEN') authStore.logout()
    else if (!sessionError && sessionData && !sessionData.user) authStore.logout()
    else if (sessionData?.user) {
      authStore.acceptProfile(sessionData.user)
      if (sessionData.catalogScopeKey) catalogCoordinator.acceptScope(sessionData.catalogScopeKey)
    }
  }, [sessionData, sessionError, isAuthenticated, isLoginPage])

  // Dynamic client-side redirect if auth state drops while on a protected page
  useEffect(() => {
    if (!isAuthenticated && !isLoginPage) {
      navigate({
        to: '/login',
        search: { redirect: routerState.location.href },
      })
    }
  }, [isAuthenticated, isLoginPage, navigate, routerState.location.href])

  return { sessionError, refetchSession }
}
