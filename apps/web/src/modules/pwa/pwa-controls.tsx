import { useEffect, useState } from 'react'
import { Button } from '@heroui/react'
import { WiFiOffIcon } from '@solar-icons/react/linear'
import { registerSW } from 'virtual:pwa-register'
import { Modal } from '@/components/ui/modal'
import { flushDrafts } from '@/lib/drafts'
import { useWriteActivity, writeActivity } from '@/lib/write-activity'
import { PwaNotice } from './pwa-notice'

interface InstallPrompt extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
let waiting = false
const update = registerSW({
  onNeedRefresh() { waiting = true; window.dispatchEvent(new Event('persianpart:update-ready')) },
  onRegisteredSW(_url, registration) {
    window.addEventListener('online', () => void registration?.update().catch(() => {}))
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && navigator.onLine) void registration?.update().catch(() => {}) })
  },
})
const installed = () => window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && navigator.standalone === true)

function manualInstallInstructions() {
  const isAppleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)

  return isAppleMobile
    ? 'در Safari، از منوی اشتراک‌گذاری گزینهٔ «افزودن به صفحهٔ اصلی» را انتخاب کنید.'
    : 'از منوی مرورگر، «نصب برنامه» یا «افزودن به صفحهٔ اصلی» را انتخاب کنید.'
}

export function PwaControls({ allowInstallInvitation }: { allowInstallInvitation: boolean }) {
  const [online, setOnline] = useState(navigator.onLine)
  const [needUpdate, setNeedUpdate] = useState(waiting)
  const [dismissed, setDismissed] = useState(false)
  const [mode, setMode] = useState<'install' | 'update' | null>(null)
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null)
  const [isInstalled, setInstalled] = useState(installed)
  const [busy, setBusy] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [invitation, setInvitation] = useState(false)
  const writes = useWriteActivity()
  const showUpdate = needUpdate && !dismissed
  const showInvitation = allowInstallInvitation && !needUpdate && invitation && !isInstalled
  useEffect(() => {
    const connection = () => setOnline(navigator.onLine)
    const ready = () => setNeedUpdate(true)
    const offer = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt) }
    const completed = () => { setInstalled(true); setPrompt(null); setMode(null) }
    const open = () => {
      setUpdateError(null)
      setMode(waiting ? 'update' : 'install')
    }
    const login = () => {
      try {
        if (!installed() && !localStorage.getItem('persianpart_install_offered')) {
          localStorage.setItem('persianpart_install_offered', '1')
          window.dispatchEvent(new Event('persianpart:install-invitation'))
          setInvitation(true)
        }
      } catch { /* Optional invitation must not interfere with login. */ }
    }
    window.addEventListener('online', connection); window.addEventListener('offline', connection)
    window.addEventListener('persianpart:update-ready', ready); window.addEventListener('beforeinstallprompt', offer)
    window.addEventListener('appinstalled', completed); window.addEventListener('persianpart:pwa-open', open)
    window.addEventListener('persianpart:login-success', login)
    return () => {
      window.removeEventListener('online', connection); window.removeEventListener('offline', connection)
      window.removeEventListener('persianpart:update-ready', ready); window.removeEventListener('beforeinstallprompt', offer)
      window.removeEventListener('appinstalled', completed); window.removeEventListener('persianpart:pwa-open', open)
      window.removeEventListener('persianpart:login-success', login)
    }
  }, [])

  const requestInstall = async () => {
    setInvitation(false)
    if (!prompt) {
      setMode('install')
      return
    }

    setPrompt(null)
    setMode(null)
    try {
      await prompt.prompt()
      await prompt.userChoice
    } catch {
      setMode('install')
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
        <PwaNotice kind="install" onOpen={() => void requestInstall()} onDismiss={() => setInvitation(false)} />
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
          <p>پرشین‌پارت روی این دستگاه در حالت نصب‌شده اجرا می‌شود.</p>
        ) : prompt ? (
          <Button fullWidth className="min-h-11" onPress={() => void requestInstall()}>افزودن به صفحهٔ اصلی</Button>
        ) : (
          <p className="text-muted">{manualInstallInstructions()}</p>
        )}
      </div>
    </Modal>
  </>
}
