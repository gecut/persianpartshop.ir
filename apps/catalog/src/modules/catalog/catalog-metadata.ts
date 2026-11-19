import type { Metadata } from 'next'
import { catalogOrigin, getCatalog } from '@/lib/catalog-server'

export async function catalogShareMetadata({
  params,
}: {
  params: Promise<{ entry?: string[] }>
}): Promise<Metadata> {
  if ((await params).entry?.length)
    return { title: 'محصول در کاتالوگ موجود نیست', robots: { index: false } }
  const { config } = await getCatalog()
  const origin = catalogOrigin(),
    image = config.shareImage ?? config.fallbackImage
  return {
    title: config.shareTitle || config.title,
    description: config.shareDescription,
    openGraph: {
      title: config.shareTitle,
      description: config.shareDescription,
      url: origin + '/',
      type: 'website',
      locale: 'fa_IR',
      ...(image ? { images: [image] } : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: config.shareTitle,
      description: config.shareDescription,
      ...(image ? { images: [image.url] } : {}),
    },
  }
}
