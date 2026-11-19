import Link from 'next/link'
export default function NotFound() {
  return (
    <section className="catalog-empty">
      <h1>محصول در کاتالوگ موجود نیست</h1>
      <p>این نشانی معتبر نیست یا محصول اکنون در کاتالوگ نمایش داده نمی‌شود.</p>
      <Link href="/" prefetch={false}>
        بازگشت به محصولات
      </Link>
    </section>
  )
}
