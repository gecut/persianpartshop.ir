'use client'
import { useState } from 'react'
import { Button, Dropdown, Label } from '@heroui/react'

export function ProductShare({ name, url }: { name: string; url: string }) {
  const [message, setMessage] = useState('')
  const [generating, setGenerating] = useState(false)
  async function downloadQR() {
    setGenerating(true)
    try {
      const { toDataURL } = await import('qrcode')
      const image = await toDataURL(url, {
        width: 512,
        margin: 2,
        errorCorrectionLevel: 'M',
      })
      const link = document.createElement('a')
      link.href = image
      link.download = `catalog-product-${new URL(url).pathname.split('/').at(-1)}.png`
      link.click()
      setMessage('کد QR محصول آماده شد.')
    } catch {
      setMessage('ساخت کد QR ممکن نشد؛ دوباره تلاش کنید.')
    } finally {
      setGenerating(false)
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setMessage('پیوند کپی شد.')
    } catch {
      setMessage('کپی خودکار ممکن نشد؛ نشانی محصول را از نوار مرورگر کپی کنید.')
    }
  }
  async function share() {
    if (!navigator.share) return copy()
    try {
      await navigator.share({ title: name, url })
    } catch (error: unknown) {
      if (!(error instanceof DOMException && error.name === 'AbortError'))
        await copy()
    }
  }
  return (
    <>
      <Dropdown>
        <Button
          type="button"
          isIconOnly
          variant="ghost"
          isPending={generating}
          aria-label="اشتراک‌گذاری محصول"
          className="w-10 control-height-10 shrink-0 bg-muted/10 text-muted hover:bg-muted/20 hover:text-foreground"
        >
          <svg
            aria-hidden="true"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="4" y="4" width="6" height="6" rx="1" />
            <rect x="14" y="4" width="6" height="6" rx="1" />
            <rect x="4" y="14" width="6" height="6" rx="1" />
            <path d="M14 14h2v2h-2zM19 14v2M14 19h2M19 19h1" />
          </svg>
        </Button>
        <Dropdown.Popover
          dir="rtl"
          placement="bottom"
          className="rounded-2xl bg-surface p-1.5 border border-border/20"
        >
          <Dropdown.Menu
            aria-label="اشتراک‌گذاری محصول"
            onAction={(key) => {
              if (key === 'share') void share()
              if (key === 'copy') void copy()
              if (key === 'qr') void downloadQR()
            }}
          >
            {[
              { id: 'share', label: 'اشتراک‌گذاری محصول' },
              { id: 'copy', label: 'کپی پیوند' },
              { id: 'qr', label: 'دریافت QR' },
            ].map((option) => (
              <Dropdown.Item
                key={option.id}
                id={option.id}
                textValue={option.label}
                className="rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer"
              >
                <Label>{option.label}</Label>
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
      <span className="sr-only" role="status" aria-live="polite">
        {message}
      </span>
    </>
  )
}
