'use client'
import { Button } from '@heroui/react'
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="catalog-empty" role="alert">
      <h1>دریافت اطلاعات ممکن نشد</h1>
      <p>اتصال را بررسی کنید و دوباره تلاش کنید.</p>
      <Button onPress={reset}>تلاش مجدد</Button>
    </section>
  )
}
