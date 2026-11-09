import { createFileRoute } from '@tanstack/react-router'
import { SupplyRequestView } from '@/modules/supply-requests/supply-request.view'
import { validateSupplyRequestSearch } from '@/modules/supply-requests/supply-request-search'

export const Route = createFileRoute('/product/supply/$id')({
  validateSearch: validateSupplyRequestSearch,
  component: SupplyRequestView,
})
