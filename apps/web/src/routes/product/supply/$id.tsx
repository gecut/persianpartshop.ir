import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { SupplyRequestForm } from '@/modules/supply-requests/supply-request-form'
import { ArrowRightIcon } from '@/components/ui/icons'

export const Route = createFileRoute('/product/supply/$id')({
  validateSearch: (search: Record<string, unknown>): { from?: 'order' } => ({ from: search.from === 'order' ? 'order' : undefined }),
  component: SupplyPage,
})

function SupplyPage() {
  const { id } = Route.useParams()
  const { from } = Route.useSearch()
  const navigate = useNavigate()
  return <div className="w-full max-w-xl mx-auto px-4 pt-4 pb-4 space-y-4">
    <header className="flex items-center gap-2 pb-2 border-b border-border/20">
      <Link to={from === 'order' ? '/product/new' : '/product'} aria-label={from === 'order' ? 'بازگشت به سفارش' : 'بازگشت به محصولات'} className="size-8 rounded-xl flex items-center justify-center text-muted"><ArrowRightIcon size={18} /></Link>
      <h1 className="text-base font-bold text-foreground">درخواست تأمین</h1>
    </header>
    <SupplyRequestForm key={id} productId={Number(id)} presentation="page" onSuccess={requestId => void navigate({ to: '/orders', search: { view: 'supply', requestId } })} onPurchase={() => void navigate({ to: '/product/new' })} />
  </div>
}
