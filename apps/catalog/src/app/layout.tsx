import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { CatalogProvider } from '@/components/catalog-provider'
import { catalogSearchKeys } from '@/lib/catalog-search'
import './globals.css'

export const metadata: Metadata = {
  title: 'کاتالوگ پرشین‌پارت',
  robots: { index: false },
}

export default function RootLayout({ children }: { children: ReactNode }) {
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
              <span className="font-bold text-foreground text-sm">محصولات</span>
              <span className="size-10 ms-1" aria-hidden="true" />
            </div>
          </header>
          <main className="flex-1 w-full flex flex-col max-w-xl mx-auto pb-8">
            {children}
          </main>
        </CatalogProvider>
      </body>
    </html>
  )
}
