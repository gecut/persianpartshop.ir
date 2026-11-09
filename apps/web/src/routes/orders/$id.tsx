import { createFileRoute } from '@tanstack/react-router'
import { OrderDetailView } from '@/modules/orders/order-detail/order-detail.view'

export const Route = createFileRoute("/orders/$id")({
  loader: async ({ params }) => {
    return { orderId: params.id };
  },
  component: OrderDetailView,
});
