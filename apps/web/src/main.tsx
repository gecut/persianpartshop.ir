import '@fontsource-variable/vazirmatn'
import { isSessionError } from './lib/session-error'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { authStore } from './features/auth/auth-store'
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

setQueryAuthErrorHandler(error => { if (isSessionError(error)) authStore.logout() })

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
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
