import { createFileRoute } from '@tanstack/react-router'
import { PlansView } from '@/modules/plans/plans.view'

export const Route = createFileRoute("/plans")({
  component: PlansView,
});
