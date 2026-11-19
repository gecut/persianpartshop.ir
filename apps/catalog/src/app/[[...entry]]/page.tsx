import { notFound } from 'next/navigation'
import { CatalogView } from '@/modules/catalog/catalog.view'
import { getCatalog } from '@/lib/catalog-server'

export const revalidate = 300
export const dynamicParams = true
export function generateStaticParams() {
  return []
}
export { catalogShareMetadata as generateMetadata } from '@/modules/catalog/catalog-metadata'

export default async function Home({
  params,
}: {
  params: Promise<{ entry?: string[] }>
}) {
  if ((await params).entry?.length) notFound()
  return <CatalogView initialPage={await getCatalog()} />
}
