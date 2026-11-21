import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { InfoCircleIcon } from '@solar-icons/react/linear'
import { BuiltBy } from '@/components/built-by'
import { getCatalog } from '@/lib/catalog-server'
import { CatalogProvider } from '@/components/catalog-provider'
import { catalogSearchKeys } from '@/lib/catalog-search'
import './globals.css'

export const metadata: Metadata = {
  title: 'کاتالوگ پرشین‌پارت',
  robots: { index: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

async function catalogTitle(): Promise<string> {
  try {
    return (await getCatalog()).config.title
  } catch {
    return 'محصولات'
  }
}

export default async function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  const title = await catalogTitle()
  const gate = `if(${JSON.stringify(catalogSearchKeys)}.some(k=>new URLSearchParams(location.search).has(k)))document.documentElement.setAttribute('data-catalog-filtered','true');`
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: gate }} />
      </head>
      <body className="min-h-dvh bg-background text-foreground font-sans antialiased overflow-x-hidden">
        <CatalogProvider>
          <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md pt-[env(safe-area-inset-top,0px)]">
            <div className="w-full px-4 h-14 max-w-xl mx-auto flex items-center justify-between gap-2">
              <Link
                href="/"
                prefetch={false}
                className="flex items-center gap-2 shrink-0 active:scale-98 transition-transform"
                aria-label="محصولات پرشین‌پارت"
              >
                <span className="flex items-center gap-1.5 size-8 rounded-xl overflow-hidden">
                  <img
                    src="/icon-192.png"
                    alt="پرشین‌پارت"
                    className="size-full object-contain"
                    width={32}
                    height={32}
                  />
                </span>
              </Link>
              <span className="min-w-0 truncate font-bold text-foreground text-sm">
                {title}
              </span>
              <a
                href="https://vc.persianpartshop.ir"
                className="size-10 shrink-0 rounded-2xl flex items-center justify-center text-muted hover:text-foreground hover:bg-muted/10 transition-colors"
                aria-label="درباره ما"
              >
                <InfoCircleIcon size={22} />
              </a>
            </div>
          </header>
          <main className="flex-1 w-full flex flex-col max-w-xl mx-auto pb-16">
            {children}
          </main>
        </CatalogProvider>
        <BuiltBy />
      </body>
    </html>
  )
}
