'use client'
import { useEffect, useRef, useState } from 'react'
import { Banner, Button, useConfig } from '@payloadcms/ui'
import {
  CatalogPreviewSchema,
  CatalogSettingsSchema,
} from '@persianpart/contract/public-catalog'
import type { z } from 'zod'
import type { CatalogFormSettings } from './_catalog-form'
import { CatalogRelationPicker } from './catalog-relation-picker'
import { CatalogPreviewResult } from './_catalog-preview-result'
import styles from './catalog-settings-field.module.css'

type PreviewState = {
  signature: string
  busy: boolean
  stale?: boolean
  result?: z.infer<typeof CatalogPreviewSchema>
  error?: string
}
export function CatalogPreview({
  settings,
  valid,
  readOnly,
}: {
  settings: CatalogFormSettings
  valid: boolean
  readOnly: boolean
}) {
  const { config } = useConfig()
  const [productId, setProductId] = useState<number | null>(null)
  const [state, setState] = useState<PreviewState | null>(null)
  const controller = useRef<AbortController | null>(null)
  const signature = JSON.stringify([settings, productId])
  useEffect(() => {
    // Results belong to one input snapshot, even if the user later undoes an edit.
    setState((previous) =>
      previous && previous.signature !== signature
        ? { signature, busy: false, stale: true }
        : previous,
    )
    return () => controller.current?.abort()
  }, [signature])
  const current = state?.signature === signature ? state : null
  async function preview() {
    const parsed = CatalogSettingsSchema.safeParse(settings)
    if (!parsed.success) return
    controller.current?.abort()
    const request = new AbortController()
    controller.current = request
    setState({ signature, busy: true })
    try {
      const response = await fetch(`${config.routes.api}/catalog-preview`, {
        method: 'POST',
        credentials: 'same-origin',
        signal: request.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: parsed.data,
          ...(productId ? { productId } : {}),
        }),
      })
      if (!response.ok) throw new Error('preview')
      const result = CatalogPreviewSchema.parse(await response.json())
      if (!request.signal.aborted) setState({ signature, busy: false, result })
    } catch {
      if (!request.signal.aborted)
        setState({
          signature,
          busy: false,
          error:
            'پیش‌نمایش دریافت نشد؛ اتصال سرویس را بررسی و دوباره تلاش کنید.',
        })
    }
  }
  return (
    <section className={styles.sectionBody} aria-busy={!!current?.busy}>
      <h2>بررسی نتیجه</h2>
      <p>
        این بررسی از تنظیمات فعلی فرم استفاده می‌کند و چیزی را ذخیره نمی‌کند.
        برای اعمال تغییرات، از دکمهٔ ذخیرهٔ بالای صفحه استفاده کنید.
      </p>
      <CatalogRelationPicker
        path="catalog-preview-product"
        label="بررسی یک محصول مشخص (اختیاری)"
        collection="products"
        single
        values={productId ? [productId] : []}
        readOnly={readOnly}
        onChange={(ids) => setProductId(ids[0] ?? null)}
      />
      <div className={styles.actions}>
        <Button
          type="button"
          buttonStyle="secondary"
          disabled={!valid || readOnly || !!current?.busy}
          onClick={() => void preview()}
        >
          {current?.busy ? 'در حال بررسی…' : 'بررسی تنظیمات فعلی'}
        </Button>
      </div>
      {!valid && <p role="status">ابتدا خطاهای فرم را اصلاح کنید.</p>}
      {state && (!current || current.stale) && (
        <p role="status">برای دیدن نتیجهٔ جدید، دوباره بررسی کنید.</p>
      )}
      {current?.error && (
        <div role="alert">
          <Banner type="error">{current.error}</Banner>
        </div>
      )}
      {current?.result && (
        <div className={styles.sectionBody} aria-live="polite">
          <CatalogPreviewResult
            result={current.result}
            paused={settings.paused}
            productId={productId}
          />
        </div>
      )}
    </section>
  )
}
