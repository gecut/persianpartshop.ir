import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Button, Modal } from '@heroui/react'
import { XIcon } from '../../components/ui/icons'
import { api } from '../../lib/api-client'
import { mapCatalogProduct } from './product-store'
import type { Product } from '../../types'

const ProductQrCamera = lazy(() => import('./product-qr-camera').then(module => ({ default: module.ProductQrCamera })))

interface ProductQrScannerProps {
  onClose: () => void
  onProduct: (product: Product) => void
}

type ScannerState = 'scanning' | 'loading' | 'not-found' | 'network-error' | 'camera-error'

export function ProductQrScanner({ onClose, onProduct }: ProductQrScannerProps) {
  const [state, setState] = useState<ScannerState>('scanning')
  const [cameraMessage, setCameraMessage] = useState('')
  const [attempt, setAttempt] = useState(0)
  const currentCode = useRef('')
  const locked = useRef(false)
  const generation = useRef(0)

  useEffect(() => () => { generation.current++ }, [])

  async function lookup(code: string) {
    if (locked.current) return
    locked.current = true
    currentCode.current = code
    const request = ++generation.current
    setState('loading')
    try {
      const product = await api.catalog.getByScanCode({ scanCode: code })
      if (generation.current === request) onProduct(mapCatalogProduct(product))
    } catch (error) {
      if (generation.current !== request) return
      const code = typeof error === 'object' && error && 'code' in error ? error.code : null
      setState(code === 'NOT_FOUND' || code === 'BAD_REQUEST' ? 'not-found' : 'network-error')
      locked.current = false
    }
  }

  function close() {
    generation.current++
    onClose()
  }

  function restart() {
    locked.current = false
    setAttempt(value => value + 1)
    setState('scanning')
  }

  return (
    <Modal.Root isOpen onOpenChange={(open) => { if (!open) close() }}>
      <Modal.Backdrop isDismissable={false} className="fixed inset-0 z-50 flex items-start justify-center bg-foreground/50 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <Modal.Container placement="top" className="w-full max-w-md">
          <Modal.Dialog className="w-full rounded-2xl bg-surface p-4 shadow-lg">
            <Modal.Header className="relative flex min-h-10 items-center justify-center px-12">
              <Modal.Heading className="text-center text-base font-bold">اسکن محصول</Modal.Heading>
              <Button isIconOnly variant="ghost" aria-label="بستن اسکنر" onPress={close} className="absolute end-0 top-0 size-10 rounded-2xl bg-muted/10 text-muted"><XIcon size={18} /></Button>
            </Modal.Header>
            <Modal.Body className="space-y-3 pt-3">
              <p className="text-center text-sm text-muted">کد QR محصول را داخل کادر بگیرید.</p>
              <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-foreground/10">
                {state === 'scanning' ? <>
                  <Suspense fallback={<p role="status" className="p-4 text-center">در حال آماده‌سازی دوربین…</p>}><ProductQrCamera key={attempt}
                    onCode={(code) => void lookup(code)}
                    onError={(error) => { if (!locked.current) { setCameraMessage(error.kind === 'permission-denied' ? 'دسترسی دوربین را در تنظیمات مرورگر فعال کنید.' : 'دسترسی به دوربین ممکن نشد. تنظیمات دستگاه را بررسی کنید.'); setState('camera-error') } }} /></Suspense>
                  <div aria-hidden="true" className="pointer-events-none absolute inset-[12%] rounded-2xl border-2 border-white" />
                  <span className="absolute bottom-2 inset-x-0 text-center text-xs text-white">در صورت درخواست، دسترسی دوربین را مجاز کنید.</span>
                </> : <div className="flex h-full flex-col items-center justify-center gap-4 p-5 text-center" role="status">
                  {state === 'loading' ? 'در حال دریافت اطلاعات محصول…' : state === 'not-found' ? 'محصولی با این کد پیدا نشد.' : state === 'camera-error' ? cameraMessage : 'دریافت محصول ممکن نشد. اتصال اینترنت و دسترسی حساب را بررسی کنید.'}
                  {state === 'network-error' && <Button onPress={() => void lookup(currentCode.current)}>تلاش مجدد</Button>}
                  {state !== 'loading' && <Button variant="secondary" onPress={restart}>اسکن دوباره</Button>}
                </div>}
              </div>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal.Root>
  )
}
