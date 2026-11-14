import { useEffect, useState } from 'react'
import { Button, Skeleton } from '@heroui/react'
import { api } from '@/lib/api-client'
import { useNetworkReadSource } from '@/modules/pwa/read-source'
import { useSavedOfflinePackage } from '@/modules/pwa/offline-package'

interface ProductQrDownloadProps { productId: string }
interface QrData { scanCode: string; png: string; svg: string }

export function ProductQrDownload({ productId }: ProductQrDownloadProps) {
  const online = useNetworkReadSource()
  const { active, restoring } = useSavedOfflinePackage()
  const storedCode = active?.data.qr[productId]
  const [data, setData] = useState<QrData | null>(null)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    setData(null)
    setError(false)
    async function load() {
      try {
        const scanCode = online ? (await api.catalog.getProductQr({ id: Number(productId) })).scanCode : storedCode
        if (!scanCode) throw new Error('QR unavailable')
        const qr = await import('qrcode')
        const options = { errorCorrectionLevel: 'M' as const, margin: 4, width: 1024 }
        const [png, svg] = await Promise.all([qr.toDataURL(scanCode, options), qr.toString(scanCode, { ...options, type: 'svg' })])
        if (active) setData({ scanCode, png, svg })
      } catch { if (active) setError(true) }
    }
    if (!restoring || online) void load()
    return () => { active = false }
  }, [productId, attempt, online, restoring, storedCode])

  function download(format: 'png' | 'svg') {
    if (!data) return
    const link = document.createElement('a')
    const objectUrl = format === 'svg' ? URL.createObjectURL(new Blob([data.svg], { type: 'image/svg+xml' })) : null
    link.href = objectUrl ?? data.png
    link.download = `product-${data.scanCode}-qr.${format}`
    link.click()
    if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
  }

  if (!online && !restoring && !storedCode) return <p role="status">برای دریافت این کد به اینترنت وصل شوید.</p>
  return <section className="flex w-full items-center gap-3 rounded-2xl bg-muted/5 p-3 text-start" aria-label="کد QR محصول">
    {error ? <>
      <p role="alert" className="text-xs text-muted">دریافت کد محصول ممکن نشد.</p>
      <Button size="sm" variant="secondary" onPress={() => setAttempt(value => value + 1)}>تلاش مجدد</Button>
    </> : !data ? <div role="status" aria-label="در حال آماده‌سازی کد QR" className="flex w-full items-center gap-3">
      <Skeleton className="size-16 shrink-0 rounded-xl" />
      <Skeleton className="h-3 w-20 rounded-lg" /><div className="ms-auto flex flex-col gap-1"><Skeleton className="h-8 w-14 rounded-xl" /><Skeleton className="h-8 w-14 rounded-xl" /></div>
    </div> : <>
      <img className="size-16 shrink-0 rounded-xl bg-white" src={data.png} alt="کد QR محصول" />
      <span dir="ltr" className="text-xs font-bold tracking-wide" data-selectable="true">{data.scanCode}</span>
      <div className="ms-auto flex shrink-0 flex-col gap-1">
        {(['png', 'svg'] as const).map(format => <Button key={format} size="sm" variant="secondary" aria-label={`دانلود ${format.toUpperCase()}`} onPress={() => download(format)} className="h-8 gap-1 rounded-xl px-2 text-xs">
          <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v11m-4-4 4 4 4-4M5 16v2a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-2" /></svg>
          <span dir="ltr">{format.toUpperCase()}</span>
        </Button>)}
      </div>
    </>}
  </section>
}
