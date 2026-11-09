import { toast } from '@/components/feedback/toast'
import { useEffect, useState } from 'react'
import { Alert, Button } from '@heroui/react'
import { CheckCircleIcon, SmartphoneIcon, SmartphoneUpdateIcon, WiFiOffIcon } from '@solar-icons/react/linear'
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
export function PwaControls() {
  const [online, setOnline] = useState(navigator.onLine)
  const [needUpdate, setNeedUpdate] = useState(waiting)
  const [dismissed, setDismissed] = useState(false)
  const [mode, setMode] = useState<'install' | 'update' | null>(null)
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null)
  const [isInstalled, setInstalled] = useState(installed)
  const [busy, setBusy] = useState(false)
  const [invitation, setInvitation] = useState(false)
  const writes = useWriteActivity()
  const showUpdate = needUpdate && !dismissed
  const showInvitation = !showUpdate && invitation && !isInstalled
  useEffect(() => {
    const connection = () => setOnline(navigator.onLine)
    const ready = () => setNeedUpdate(true)
    const offer = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt) }
    const completed = () => { setInstalled(true); setPrompt(null); setMode(null) }
    const open = () => setMode(waiting ? 'update' : 'install')
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
  const applyUpdate = async () => {
    if (writeActivity.count() || !flushDrafts()) return
    setBusy(true)
    try { await update(true) }
    catch { toast.error('بروزرسانی انجام نشد', 'اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.') }
    finally { setBusy(false) }
  }
  return <>
    {!online && <div role="status" className="flex items-center justify-center gap-2 bg-warning/15 px-3 py-2 text-xs leading-5 text-warning-foreground">
      <WiFiOffIcon aria-hidden="true" size={16} className="shrink-0 text-warning" />
      <span>اینترنت قطع است؛ اطلاعات ذخیره‌شده نمایش داده می‌شود.</span>
    </div>}
    {(showUpdate || showInvitation) && <div className="flex flex-col gap-2 py-3">
      {showUpdate && <PwaNotice kind="update" onOpen={() => setMode('update')} onDismiss={() => setDismissed(true)} />}
      {showInvitation && <PwaNotice kind="install" onOpen={() => setMode('install')} onDismiss={() => setInvitation(false)} />}
    </div>}
    <Modal isOpen={mode !== null} onClose={() => setMode(null)} title={mode === 'update' ? 'بروزرسانی پرشین‌پارت' : 'نصب پرشین‌پارت'}>
      <div className="space-y-4 text-sm leading-7">
        {mode === 'update' ? <>
          <Alert status="accent" className="pwa-alert">
            <Alert.Indicator aria-hidden="true"><SmartphoneUpdateIcon size={20} /></Alert.Indicator>
            <Alert.Content>
              <Alert.Title>نسخهٔ تازهٔ پرشین‌پارت</Alert.Title>
              <Alert.Description>پیش از بروزرسانی، تلاش می‌کنیم پیش‌نویس‌های شما را ذخیره کنیم. سپس برنامه دوباره باز می‌شود.</Alert.Description>
            </Alert.Content>
          </Alert>
          {writes > 0 && <Alert status="warning" className="pwa-alert"><Alert.Indicator /><Alert.Content><Alert.Description>ابتدا منتظر پایان ارسال اطلاعات در پنجره‌های برنامه بمانید.</Alert.Description></Alert.Content></Alert>}
          <Button fullWidth isDisabled={!needUpdate || writes > 0 || busy} isPending={busy} onPress={() => void applyUpdate()}>بروزرسانی و باز کردن برنامه</Button>
        </> : isInstalled ? <Alert status="success" className="pwa-alert">
          <Alert.Indicator aria-hidden="true"><CheckCircleIcon size={20} /></Alert.Indicator>
          <Alert.Content><Alert.Title>برنامه نصب شده است</Alert.Title><Alert.Description>پرشین‌پارت روی این دستگاه در حالت نصب‌شده اجرا می‌شود.</Alert.Description></Alert.Content>
        </Alert> : <>
          <Alert status="accent" className="pwa-alert">
            <Alert.Indicator aria-hidden="true"><SmartphoneIcon size={20} /></Alert.Indicator>
            <Alert.Content>
              <Alert.Title>دسترسی سریع به پرشین‌پارت</Alert.Title>
              <Alert.Description>با افزودن برنامه به صفحهٔ اصلی، هر زمان راحت‌تر به محصولات و سفارش‌هایتان دسترسی دارید.</Alert.Description>
            </Alert.Content>
          </Alert>
          {prompt ? <Button fullWidth onPress={async () => {
            try { await prompt.prompt(); await prompt.userChoice; setMode(null) }
            catch { toast.info('نصب خودکار در دسترس نیست', 'از منوی مرورگر برای افزودن برنامه استفاده کنید.') }
            finally { setPrompt(null) }
          }}>افزودن به صفحهٔ اصلی</Button> : <p className="text-muted leading-7">{/iPhone|iPad|iPod/.test(navigator.userAgent) ? 'در Safari، از منوی اشتراک‌گذاری گزینهٔ «افزودن به صفحهٔ اصلی» را انتخاب کنید.' : 'از منوی مرورگر، «نصب برنامه» یا «افزودن به صفحهٔ اصلی» را انتخاب کنید.'}</p>}
        </>}
      </div>
    </Modal>
  </>
}
