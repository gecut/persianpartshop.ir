import {
  loadProduct,
  productShareMetadata,
} from '@/modules/product/product-server'
import { ProductView } from '@/modules/product/product.view'

export const revalidate = 300
export const dynamicParams = true
export function generateStaticParams() {
  return []
}
export const generateMetadata = productShareMetadata
export default async function ProductPage({
  params,
}: {
  params: Promise<{ identifier: string }>
}) {
  const data = await loadProduct((await params).identifier)
  return <ProductView {...data} />
}
