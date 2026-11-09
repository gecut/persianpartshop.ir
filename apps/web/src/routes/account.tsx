import { createFileRoute } from '@tanstack/react-router'
import { AccountView } from '@/modules/account/account.view'

export const Route = createFileRoute('/account')({
  component: AccountView,
})
