import { createFileRoute } from '@tanstack/react-router'
import { ActivityFeedView } from '@/modules/orders/activity-feed/activity-feed.view'
import { validateActivityFeedSearch } from '@/modules/orders/orders-search'

export const Route = createFileRoute('/orders/')({
  validateSearch: validateActivityFeedSearch,
  component: ActivityFeedView,
})
