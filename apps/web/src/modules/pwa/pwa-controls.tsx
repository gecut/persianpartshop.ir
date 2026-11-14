import { useEffect, useState, useSyncExternalStore } from 'react'
import { Button, ProgressBar } from '@heroui/react'
import { WiFiOffIcon } from '@solar-icons/react/linear'
import { registerSW } from 'virtual:pwa-register'
import { Modal } from '@/components/ui/modal'
import { flushDrafts } from '@/lib/drafts'
import { useWriteActivity, writeActivity } from '@/lib/write-activity'
import { PwaNotice } from './pwa-notice'
import { OfflineProgress } from './_offline-progress'
import { useAuth } from '@/modules/auth/auth-store'
import { getInstallPrompt, subscribeToInstallPrompt, takeInstallPrompt } from './_install-prompt'

let waiting = false
const serviceWorkers = navigator.serviceWorker
let controller = serviceWorkers?.controller
serviceWorkers?.addEventListener('controllerchange', () => {
  const previous = controller
  const next = serviceWorkers.controller
  controller = next
  if (!previous || !next || previous === next) return

  // controllerchange can arrive before the worker finishes its activate event.
  const reload = () => {
    if (next.state === 'activating') return
    next.removeEventListener('statechange', reload)
    if (next.state === 'activated' && flushDrafts()) window.location.reload()
  }
  next.addEventListener('statechange', reload)
  reload()
})

const update = registerSW({
  onNeedRefresh() { waiting = true; window.dispatchEvent(new Event('persianpart:update-ready')) },
  onNeedReload() { /* The controller listener reloads once activation is complete. */ },
  onRegisteredSW(_url, registration) {
    window.addEventListener('online', () => void registration?.update().catch(() => {}))
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && navigator.onLine) void registration?.update().catch(() => {}) })
  },
})
const installed = () => window.matchMedia('(display-mode: standalone), (display-mode: window-controls-overlay)').matches ||
  ('standalone' in navigator && navigator.standalone === true)
const isAppleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
const isMacSafari = !isAppleMobile && /Macintosh.+Version\/[^ ]+ Safari\//.test(navigator.userAgent)

export function PwaControls({ allowInstallInvitation }: { allowInstallInvitation: boolean }) {
  const { user } = useAuth()
  const [online, setOnline] = useState(navigator.onLine)
  const [needUpdate, setNeedUpdate] = useState(waiting)
  const [dismissed, setDismissed] = useState(false)
  const [mode, setMode] = useState<'install' | 'update' | null>(null)
  const prompt = useSyncExternalStore(subscribeToInstallPrompt, getInstallPrompt)
  const [isInstalled, setInstalled] = useState(installed)
  const [busy, setBusy] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [invitation, setInvitation] = useState(false)
  const writes = useWriteActivity()
  const showUpdate = needUpdate && !dismissed
  const showInvitation = allowInstallInvitation && !needUpdate && invitation && !isInstalled &&
    (prompt !== null || isAppleMobile || isMacSafari)
  useEffect(() => {
    const connection = () => setOnline(navigator.onLine)
    const ready = () => setNeedUpdate(true)
    const completed = () => { setInstalled(true); setInstalling(false) }
    const open = () => {
      setUpdateError(null)
      setMode(waiting ? 'update' : 'install')
    }
    const login = () => {
      try {
        if (!installed() && !localStorage.getItem('persianpart_install_offered')) {
          setInvitation(true)
        }
      } catch { /* Optional invitation must not interfere with login. */ }
    }
    window.addEventListener('online', connection); window.addEventListener('offline', connection)
    window.addEventListener('persianpart:update-ready', ready)
    window.addEventListener('appinstalled', completed); window.addEventListener('persianpart:pwa-open', open)
    window.addEventListener('persianpart:login-success', login)
    return () => {
      window.removeEventListener('online', connection); window.removeEventListener('offline', connection)
      window.removeEventListener('persianpart:update-ready', ready)
      window.removeEventListener('appinstalled', completed); window.removeEventListener('persianpart:pwa-open', open)
      window.removeEventListener('persianpart:login-success', login)
    }
  }, [])

  useEffect(() => {
    if (!showInvitation) return
    try {
      if (localStorage.getItem('persianpart_install_offered')) return
      localStorage.setItem('persianpart_install_offered', '1')
      window.dispatchEvent(new Event('persianpart:install-invitation'))
    } catch { /* The invitation still works when storage is unavailable. */ }
  }, [showInvitation])

  const requestInstall = async () => {
    setInvitation(false)
    const nativePrompt = takeInstallPrompt()
    if (!nativePrompt) {
      setMode('install')
      return
    }

    setInstalling(true)
    try {
      await nativePrompt.prompt()
    } catch {
      setMode('install')
    } finally {
      setInstalling(false)
    }
  }

  const applyUpdate = async () => {
    if (!needUpdate || busy || writeActivity.count()) return
    setUpdateError(null)
    if (!flushDrafts()) {
      setUpdateError('پیش‌نویس‌ها ذخیره نشدند. دوباره تلاش کنید.')
      return
    }

    setBusy(true)
    const worker = navigator.serviceWorker
    let timeout: number | undefined
    let onControllerChange: (() => void) | undefined
    try {
      // The PWA helper sends the message; it does not wait for the new worker.
      const activated = new Promise<void>((resolve, reject) => {
        onControllerChange = () => resolve()
        worker.addEventListener('controllerchange', onControllerChange, { once: true })
        timeout = window.setTimeout(() => reject(new Error('Update activation timed out')), 15_000)
      })
      await Promise.all([activated, update(true)])
    } catch {
      setUpdateError('به‌روزرسانی انجام نشد. دوباره تلاش کنید.')
    } finally {
      window.clearTimeout(timeout)
      if (onControllerChange) worker.removeEventListener('controllerchange', onControllerChange)
      setBusy(false)
    }
  }
  return <>
    {!online && <div role="status" className="flex items-center justify-center gap-2 bg-warning/15 px-3 py-2 text-xs leading-5 text-warning-foreground">
      <WiFiOffIcon aria-hidden="true" size={16} className="shrink-0 text-warning" />
      <span>اتصال اینترنت قطع است.</span>
    </div>}
    {(showUpdate || showInvitation) && <div className="mx-auto w-full max-w-xl px-4 py-3">
      {showUpdate ? (
        <PwaNotice kind="update" onOpen={() => {
          setUpdateError(null)
          setMode('update')
        }} onDismiss={() => setDismissed(true)} />
      ) : (
          <PwaNotice kind="install" onOpen={() => { setInvitation(false); setMode('install') }} onDismiss={() => setInvitation(false)} />
      )}
    </div>}
    <Modal isOpen={mode !== null} onClose={() => setMode(null)} title={mode === 'update' ? 'به‌روزرسانی پرشین‌پارت' : 'نصب پرشین‌پارت'}>
      <div className="space-y-4 text-sm leading-7">
        {mode === 'update' ? <>
          {writes > 0 && <p role="status" className="text-foreground">منتظر بمانید تا ارسال اطلاعات در پنجره‌های برنامه تمام شود.</p>}
          {updateError && <p role="alert" className="text-danger">{updateError}</p>}
          <Button fullWidth className="min-h-11" isDisabled={!needUpdate || writes > 0 || busy} isPending={busy} onPress={() => void applyUpdate()}>
            به‌روزرسانی و باز کردن دوبارهٔ برنامه
          </Button>
        </> : isInstalled ? (
          <p>پرشین‌پارت روی این دستگاه نصب شده است.</p>
        ) : prompt ? (
          <Button fullWidth className="min-h-11" isDisabled={installing} onPress={() => void requestInstall()}>نصب پرشین‌پارت</Button>
        ) : isAppleMobile ? (
          <p className="text-muted">
            در <bdi>Safari</bdi>، از منوی اشتراک‌گذاری «افزودن به صفحهٔ اصلی» را انتخاب کنید.
            اگر گزینهٔ <bdi>Open as Web App</bdi> را می‌بینید، آن را روشن کنید و «افزودن» را بزنید.
          </p>
        ) : isMacSafari ? (
          <p className="text-muted">در منوی <bdi>File</bdi> مرورگر، گزینهٔ <bdi>Add to Dock</bdi> را انتخاب کنید.</p>
        ) : (
          <p className="text-muted">
            در <bdi>Chrome</bdi> یا <bdi>Edge</bdi>، از منوی مرورگر گزینهٔ «نصب برنامه» را انتخاب کنید.
            در <bdi>Chrome</bdi> اندروید، این گزینه ممکن است در منوی «افزودن به صفحهٔ اصلی» باشد.
          </p>
        )}
        {(busy || installing) && <ProgressBar isIndeterminate aria-label={busy ? 'فعال‌سازی نسخهٔ جدید' : 'در انتظار نصب برنامه'}>
          <ProgressBar.Track><ProgressBar.Fill /></ProgressBar.Track>
        </ProgressBar>}
        {user && <OfflineProgress online={online} />}
      </div>
    </Modal>
  </>
}
