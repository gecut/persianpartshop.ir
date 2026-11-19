'use client'
import { useEffect, useState } from 'react'
import { Button, useConfig } from '@payloadcms/ui'
import { CatalogLocationSchema } from '@persianpart/contract/public-catalog'
import styles from './catalog-settings-field.module.css'

export function CatalogLocation() {
  const { config } = useConfig()
  const [url, setURL] = useState('')
  const [message, setMessage] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    void fetch(`${config.routes.api}/catalog-location`, {
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('location')
        const result = CatalogLocationSchema.parse(await response.json())
        if (!controller.signal.aborted) setURL(result.url)
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setMessage(
            'نشانی کاتالوگ دریافت نشد؛ تنظیمات فرم همچنان قابل ویرایش است.',
          )
      })
    return () => controller.abort()
  }, [config.routes.api])
  return (
    <div>
      {url && (
        <div className={styles.actions}>
          <Button
            el="anchor"
            url={url}
            newTab
            buttonStyle="secondary"
            size="small"
          >
            مشاهدهٔ کاتالوگ
          </Button>
          <Button
            type="button"
            buttonStyle="secondary"
            size="small"
            onClick={() => {
              void (async () => {
                try {
                  await navigator.clipboard.writeText(url)
                  setMessage('نشانی کاتالوگ کپی شد.')
                } catch {
                  setMessage('کپی ممکن نشد؛ نشانی را از پیوند کاتالوگ بردارید.')
                }
              })()
            }}
          >
            کپی نشانی
          </Button>
        </div>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  )
}
