import Link from 'next/link'

export function QrInactive() {
  return (
    <section className="catalog-empty">
      <h1>این کد در حال حاضر فعال نیست</h1>
      <p>برای مشاهدهٔ محصولات می‌توانید به کاتالوگ مراجعه کنید.</p>
      <Link href="/" prefetch={false}>
        مشاهدهٔ کاتالوگ
      </Link>
    </section>
  )
}
