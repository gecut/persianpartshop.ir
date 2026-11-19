import 'server-only'
import { notFound } from 'next/navigation'
import { catalogOrigin, getProduct } from '@/lib/catalog-server'
import { isCatalogNotFound } from '@/lib/catalog-cms'
import { buildProductShareMetadata } from './_product-share-metadata'

export async function loadProduct(identifier: string) {
  if (
    !/^[1-9]\d*$/.test(identifier) ||
    !Number.isSafeInteger(Number(identifier))
  )
    notFound()
  try {
    return await getProduct(Number(identifier))
  } catch (error: unknown) {
    if (isCatalogNotFound(error)) notFound()
    throw error
  }
}

type ProductMetadataProps = { params: Promise<{ identifier: string }> }

export async function productShareMetadata({ params }: ProductMetadataProps) {
  const data = await loadProduct((await params).identifier)
  return buildProductShareMetadata(data, catalogOrigin())
}
