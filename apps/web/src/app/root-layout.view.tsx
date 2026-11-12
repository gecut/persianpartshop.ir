import { Outlet, useRouterState } from '@tanstack/react-router'
import { NuqsAdapter } from 'nuqs/adapters/tanstack-router'
import { ToastContainer } from '@/components/feedback/toast'
import { AppHeader } from '@/app/app-header'
import { MobileBottomNav } from '@/app/mobile-bottom-nav'
import { useSessionSync } from '@/app/use-session-sync'
import { useAuth } from '@/modules/auth/auth-store'
import { WarehouseSelection } from '@/modules/cart/warehouse-selection'
import { PwaControls } from '@/modules/pwa/pwa-controls'
import { cn } from '@/lib/utils'

export function RootLayoutView() {
  const { user } = useAuth()
  const routerState = useRouterState()
  const pathname = routerState.location.pathname
  const isLoginPage = pathname === '/login'

  useSessionSync(isLoginPage)

  return (
    <NuqsAdapter>
      <div
        className={cn(
          'flex justify-center select-none w-full max-w-full overflow-x-hidden',
          isLoginPage ? 'h-dvh overflow-hidden bg-login-background' : 'min-h-dvh bg-background'
        )}
        dir="rtl"
      >
        <div
          className={cn(
            'w-full text-foreground font-sans antialiased flex flex-col max-w-full overflow-x-hidden',
            isLoginPage ? 'h-dvh overflow-hidden bg-login-background' : 'min-h-dvh bg-background'
          )}
        >
          {!isLoginPage && <AppHeader />}
          <ToastContainer />
          <PwaControls allowInstallInvitation={!isLoginPage} />
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
            <Outlet key={user?.id ?? 'guest'} />
          </main>

          {/* Permanent Bottom Navigation Bar (Hidden on login) */}
          {!isLoginPage && <MobileBottomNav />}
        </div>
      </div>
    </NuqsAdapter>
  )
}

