import { createFileRoute } from '@tanstack/react-router'
import { ProductListView } from '@/modules/products/product-list.view'
import { validateProductListSearch } from '@/modules/products/product-search'

export const Route = createFileRoute("/product/")({
  validateSearch: validateProductListSearch,
  component: ProductListView,
});
