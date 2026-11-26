'use client'

import { useDocumentInfo, useField } from '@payloadcms/ui'

export function QrPreview() {
  const { id } = useDocumentInfo()
  const token = useField<string>({ path: 'token' }).value
  if (!id) return <p dir="rtl">پس از ذخیره، پیش‌نمایش برچسب اینجا نمایش داده می‌شود.</p>
  return (
    <div dir="rtl" style={{ display: 'grid', gap: 8, maxWidth: 360 }}>
      <strong>پیش‌نمایش برچسب (۶ × ۸ سانتی‌متر)</strong>
      <img src={`/api/qr-codes/preview?id=${id}`} alt="پیش‌نمایش برچسب QR" style={{ width: '100%', border: '1px solid var(--theme-elevation-150)' }} />
      {token && <code dir="ltr" data-selectable="true">{`/Q/${token}`}</code>}
    </div>
  )
}
