import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { authStore } from './features/auth/auth-store'
import { toast } from './components/feedback/toast'
import { queryClient, setQueryAuthErrorHandler } from './lib/query-client'
import './styles/globals.css'

// Globally disable text selection except in inputs and editable areas
if (typeof window !== 'undefined') {
  document.addEventListener('selectstart', (e) => {
    const target = e.target as HTMLElement | null
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        Boolean(target.closest('input, textarea, [contenteditable="true"], [data-selectable="true"]')))
    ) {
      return
    }
    e.preventDefault()
  })
}

const handleQueryAuthError = (error: unknown) => {
  const err = error as any
  const msg = err?.message || err?.error?.message || ''
  const isBanned =
    err?.data?.code === 'USER_BANNED' ||
    err?.error?.data?.code === 'USER_BANNED' ||
    msg.includes('توسط مدیریت مسدود') ||
    msg.includes('مسدود گردید')

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
}

setQueryAuthErrorHandler(handleQueryAuthError)

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('root')
if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </React.StrictMode>,
  )
}
