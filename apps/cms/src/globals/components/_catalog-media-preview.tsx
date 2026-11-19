'use client'
import { useEffect, useState } from 'react'
import { useConfig } from '@payloadcms/ui'
import { z } from 'zod'
import styles from './catalog-settings-field.module.css'

const imageSchema = z.object({
  url: z.string().nullable().optional(),
  thumbnailURL: z.string().nullable().optional(),
  alt: z.string().nullable().optional(),
})
export function CatalogMediaPreview({ id }: { id: number }) {
  const { config } = useConfig()
  const [image, setImage] = useState<{
    id: number
    url: string
    alt: string
  } | null>(null)
  const [failedId, setFailedId] = useState<number | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    void fetch(`${config.routes.api}/media/${id}?depth=0`, {
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('media')
        const data = imageSchema.parse(await response.json())
        const url = data.thumbnailURL || data.url
        if (!url) throw new Error('image')
        setImage({ id, url, alt: data.alt || 'تصویر انتخاب‌شده' })
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailedId(id)
      })
    return () => controller.abort()
  }, [id, config.routes.api])
  if (failedId === id)
    return <p role="status">نمایش تصویر ممکن نشد؛ انتخاب شما حفظ شده است.</p>
  if (image?.id !== id) return <p role="status">در حال دریافت تصویر…</p>
  return (
    <a
      href={image.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="مشاهدهٔ تصویر انتخاب‌شده"
    >
      <img
        className={styles.media}
        src={image.url}
        alt={image.alt}
        loading="lazy"
        onError={() => setFailedId(id)}
      />
    </a>
  )
}
