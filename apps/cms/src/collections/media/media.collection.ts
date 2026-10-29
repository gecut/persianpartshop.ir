import type { CollectionConfig } from 'payload'
import { isCatalogManager } from '../../access/roles'

export function buildCdnUrl(filename: string | null | undefined): string | null {
  if (!filename) return null
  const cdnUrl = process.env.CDN_URL
  if (!cdnUrl) return null
  return `${cdnUrl.replace(/\/+$/, '')}/${encodeURIComponent(filename)}`
}

export const Media: CollectionConfig = {
  slug: 'media',
  labels: {
    singular: 'فایل رسانه\u200cای',
    plural: 'رسانه\u200cها و تصاویر',
  },
  admin: {
    group: 'رسانه و محتوا',
    description: 'مدیریت تصاویر کالاها، لوگوها و فایل\u200cهای سیستم',
  },
  access: {
    read: () => true,
    create: isCatalogManager,
    update: isCatalogManager,
    delete: isCatalogManager,
  },
  hooks: {
    afterRead: [
      ({ doc }) => {
        if (doc.filename) {
          const cdnUrl = buildCdnUrl(doc.filename)
          if (cdnUrl) {
            doc.url = cdnUrl
          }
        }
        return doc
      },
    ],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      label: 'متن جایگزین (Alt)',
      admin: {
        description: 'توضیح کوتاه تصویر جهت سئو و دسترس\u200cپذیری.',
      },
    },
  ],
  upload: {
    staticDir: 'media',
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
    resizeOptions: {
      width: 1600,
      height: 1600,
      fit: 'inside',
      withoutEnlargement: true,
    },
    formatOptions: {
      format: 'webp',
      options: {
        quality: 82,
        alphaQuality: 100,
        effort: 4,
      },
    },
    withMetadata: false,
    adminThumbnail: ({ doc }) => {
      const filename = (doc as any)?.filename
      return buildCdnUrl(filename) || ''
    },
  },
}
