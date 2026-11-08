import { PwaControls } from '../features/pwa/pwa-controls'
import { DataStatus } from '../components/feedback/data-status'
import { selectionStore } from '../features/products/selection-store'
import { supplyDraftStore } from '../features/supply-requests/supply-request-draft'
import { WarehouseSelection, WarehouseSummary } from '../features/cart/warehouse-selection'
import { useEffect } from 'react'
import { createRootRoute, Outlet, redirect, useNavigate, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { AppHeader } from '../components/layout/app-header'
import { MobileBottomNav } from '../components/layout/mobile-bottom-nav'
import { ToastContainer } from '../components/feedback/toast'
import { authStore, useAuth } from '../features/auth/auth-store'
import { api } from '../lib/api-client'
import { queryKeys } from '../lib/query-keys'
import { NuqsAdapter } from 'nuqs/adapters/tanstack-router'
import { cn } from '../lib/utils'

export const Route = createRootRoute({
  beforeLoad: ({ location }) => {
    const isAuth = authStore.getState().isAuthenticated
    const isLoginPage = location.pathname === '/login'

    if (!isAuth && !isLoginPage) {
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
        },
      })
    }

    if (isAuth && isLoginPage) {
      const destination = new URL(location.href, window.location.origin).searchParams.get('redirect')
      let target: URL | undefined
      try { if (typeof destination === 'string') target = new URL(destination, window.location.origin) } catch { /* Invalid login destination. */ }
      if (target && target.origin === window.location.origin && target.pathname !== '/login') throw redirect({ href: target.pathname + target.search + target.hash })
      throw redirect({ to: '/product' })
    }
  },
  component: RootComponent,
})

function RootComponent() {
  const { isAuthenticated, user } = useAuth()
  const routerState = useRouterState()
  const navigate = useNavigate()
  const pathname = routerState.location.pathname
  const isLoginPage = pathname === '/login'

  useEffect(() => { selectionStore.setOwner(isAuthenticated && user ? String(user.id) : '') }, [isAuthenticated, user?.id])
  useEffect(() => { supplyDraftStore.setOwner(isAuthenticated && user ? String(user.id) : '') }, [isAuthenticated, user?.id])

  // Periodic background check of session validity and ban status (every 4 seconds and on focus)
  const { data: sessionData, error: sessionError, refetch: refetchSession } = useQuery({
    queryKey: queryKeys.auth.session(),
    queryFn: async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('persianpart_token') : null
      if (!token) return null
      return api.auth.session()
    },
    enabled: isAuthenticated && !isLoginPage,
    refetchInterval: 4_000,
    refetchOnWindowFocus: true,
    retry: false,
  })

  useEffect(() => {
    if (!isAuthenticated || isLoginPage) return

    if (sessionError && typeof sessionError === 'object' && 'code' in sessionError && sessionError.code === 'FORBIDDEN') authStore.logout()
    else if (!sessionError && sessionData && !sessionData.user) authStore.logout()
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

  return (
    <NuqsAdapter>
      <div
        className={cn(
          'flex justify-center select-none w-full max-w-full overflow-x-hidden',
          isLoginPage ? 'h-dvh overflow-hidden bg-[#f8f8fa]' : 'min-h-dvh bg-background'
        )}
        dir="rtl"
      >
        <div
          className={cn(
            'w-full text-foreground font-sans antialiased flex flex-col max-w-full overflow-x-hidden',
            isLoginPage ? 'h-dvh overflow-hidden bg-[#f8f8fa]' : 'min-h-dvh bg-background'
          )}
        >
          {!isLoginPage && <AppHeader />}
          <ToastContainer />
          <PwaControls />
          {isAuthenticated && sessionError && <DataStatus error={sessionError} hasData onRetry={() => void refetchSession()} />}
          <WarehouseSelection />
          {/* Main App Content Area */}
          <main
            className={cn(
              'flex-1 w-full flex flex-col',
              isLoginPage
                ? 'h-full overflow-hidden relative'
                : 'max-w-xl mx-auto pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]'
            )}
          >
            {pathname.startsWith('/product') && <WarehouseSummary />}
            <Outlet key={user?.id ?? 'guest'} />
          </main>

          {/* Permanent Bottom Navigation Bar (Hidden on login) */}
          {!isLoginPage && <MobileBottomNav />}
        </div>
      </div>
    </NuqsAdapter>
  )
}

