import { redirect, type ParsedLocation } from '@tanstack/react-router'
import { authStore } from '@/modules/auth/auth-store'

export function authGuard({ location }: { location: ParsedLocation }) {
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
}
