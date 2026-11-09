import { createFileRoute } from '@tanstack/react-router'
import { LoginView } from '@/modules/auth/login.view'

export const Route = createFileRoute("/login")({
  component: LoginView,
});
