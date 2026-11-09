import { createRootRoute } from '@tanstack/react-router'
import { authGuard } from '@/app/auth-guard'
import { RootLayoutView } from '@/app/root-layout.view'

export const Route = createRootRoute({
  beforeLoad: authGuard,
  component: RootLayoutView,
})
