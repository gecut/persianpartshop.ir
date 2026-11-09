import { createFileRoute } from '@tanstack/react-router'
import { ProductNewView } from '@/modules/products/product-new.view'

export const Route = createFileRoute("/product/new")({
  component: ProductNewView,
});
