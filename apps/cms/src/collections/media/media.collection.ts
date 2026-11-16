import { createHash } from 'node:crypto'
import type { CollectionConfig, ImageSize } from 'payload'
import type { Media as MediaDocument } from '../../payload-types'
import { isCatalogManager } from '../../access/roles'

export function buildCdnUrl(filename: string | null | undefined): string | null {
  if (!filename) return null
  const cdnUrl = process.env.CDN_URL
  if (!cdnUrl) return null
  return `${cdnUrl.replace(/\/+$/, '')}/${encodeURIComponent(filename)}`
}

export const galleryImageSizes = [
  { name: 'galleryThumb', edge: 256, quality: 78 },
  { name: 'galleryPreview', edge: 1024, quality: 82 },
] as const

const imageSizes = galleryImageSizes.map(({ name, edge, quality }): ImageSize => ({
  name,
  width: edge,
  height: edge,
  fit: 'inside',
  withoutEnlargement: true,
  formatOptions: { format: 'webp', options: { quality, alphaQuality: 100, effort: 4 } },
  generateImageName: ({ originalName, extension }) =>
    `gallery-${createHash('sha256').update(originalName).digest('hex').slice(0, 24)}-${edge}.${extension}`,
}))

export const Media: CollectionConfig = {
  slug: 'media',
  labels: {
    singular: 'فایل رسانه\u200cای',
    plural: 'رسانه\u200cها و تصاویر',
  },
  admin: {
    group: 'رسانه و محتوا',
    defaultColumns: ['filename', 'alt', 'mimeType', 'filesize', 'updatedAt'],
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
        for (const { name } of galleryImageSizes) {
          const size = doc.sizes?.[name]
          if (size?.filename) {
            size.url = buildCdnUrl(size.filename) || `/api/media/file/${encodeURIComponent(size.filename)}`
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
    imageSizes,
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
      const media = doc as Partial<MediaDocument>
      const filename = media.sizes?.galleryThumb?.filename ?? media.filename
      return typeof filename === 'string'
        ? buildCdnUrl(filename) || `/api/media/file/${encodeURIComponent(filename)}`
        : ''
    },
  },
}
