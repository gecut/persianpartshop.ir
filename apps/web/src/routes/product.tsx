import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/product')({
  component: ProductLayout,
})

function ProductLayout() {
  return <Outlet />
}
 