import { createFileRoute } from '@tanstack/react-router'
import { CartView } from '@/modules/cart/cart-view/cart.view'

export const Route = createFileRoute('/cart')({
  component: CartView,
})
