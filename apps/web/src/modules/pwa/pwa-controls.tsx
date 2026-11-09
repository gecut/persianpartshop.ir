import { toast } from '@/components/feedback/toast'
import { useEffect, useState } from 'react'
import { Button } from '@heroui/react'
import { registerSW } from 'virtual:pwa-register'
import { Modal } from '@/components/ui/modal'
import { flushDrafts } from '@/lib/drafts'
import { useWriteActivity, writeActivity } from '@/lib/write-activity'

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
    catch { toast.error('بروزرسانی انجام نشد', 'اتصال را بررسی کنید و دوباره تلاش کنید.') }
    finally { setBusy(false) }
  }
  return <>
    {!online && <div role="status" className="bg-warning/15 p-3 text-center text-sm">اتصال اینترنت قطع است؛ اطلاعات موجود نمایش داده می‌شود. برای دریافت اطلاعات تازه دوباره متصل شوید.</div>}
    {((needUpdate && !dismissed) || (invitation && !isInstalled)) && <div role="status" className="flex flex-wrap items-center justify-center gap-3 bg-surface p-3 text-sm">
      <span>{needUpdate ? 'نسخهٔ جدید برنامه آماده است.' : 'پرشین‌پارت را روی دستگاه نصب کنید.'}</span>
      <Button size="sm" variant="secondary" onPress={() => setMode(needUpdate ? 'update' : 'install')}>{needUpdate ? 'مشاهدهٔ بروزرسانی' : 'نصب برنامه'}</Button>
      <Button size="sm" variant="ghost" onPress={() => { setDismissed(true); setInvitation(false) }}>بعداً</Button>
    </div>}
    <Modal isOpen={mode !== null} onClose={() => setMode(null)} title={mode === 'update' ? 'بروزرسانی پرشین‌پارت' : 'نصب پرشین‌پارت'}>
      <div className="space-y-4 text-sm leading-7">
        {mode === 'update' ? <>
          <p>نسخهٔ جدید آماده است. پیش‌نویس شما پیش از بروزرسانی ذخیره می‌شود.</p>
          {writes > 0 && <p role="status">ابتدا منتظر پایان ارسال اطلاعات در پنجره‌های برنامه بمانید.</p>}
          <Button isDisabled={writes > 0 || busy} isPending={busy} onPress={() => void applyUpdate()}>بروزرسانی اکنون</Button>
        </> : isInstalled ? <p>برنامه روی این دستگاه در حالت نصب‌شده اجرا می‌شود.</p> : prompt ? <>
          <p>برای دسترسی سریع، برنامه را به صفحهٔ اصلی دستگاه اضافه کنید.</p>
          <Button onPress={async () => {
            try { await prompt.prompt(); await prompt.userChoice; setMode(null) }
            catch { toast.info('نصب خودکار در دسترس نیست', 'از راهنمای نصب مرورگر استفاده کنید.') }
            finally { setPrompt(null) }
          }}>نصب برنامه</Button>
        </> : <p>{/iPhone|iPad|iPod/.test(navigator.userAgent) ? 'از منوی اشتراک‌گذاری مرورگر، «افزودن به صفحهٔ اصلی» را انتخاب کنید. در صورت نبود این گزینه، لینک را در Safari باز کنید.' : 'از منوی مرورگر گزینهٔ «نصب برنامه» یا «افزودن به صفحهٔ اصلی» را انتخاب کنید. اگر این گزینه موجود نیست، از مرورگر پشتیبان استفاده کنید.'}</p>}
      </div>
    </Modal>
  </>
}
export function PwaAccountButton() {
  return <Button variant="secondary" onPress={() => window.dispatchEvent(new Event('persianpart:pwa-open'))}>نصب و بروزرسانی برنامه</Button>
}
