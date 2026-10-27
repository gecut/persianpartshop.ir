import { createFileRoute } from '@tanstack/react-router'
import { ProfileView } from '../features/account/profile-view'

export const Route = createFileRoute('/account')({
  component: AccountPage,
})

function AccountPage() {
  return (
    <div className="w-full px-3 py-3">
      <ProfileView />
    </div>
  )
}
