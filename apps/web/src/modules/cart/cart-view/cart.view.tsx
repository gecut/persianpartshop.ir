import { useTextDraft } from '@/lib/drafts'
import { selectionStore } from '@/modules/products/selection-store'
import { WarehouseSummary } from '@/modules/cart/warehouse-summary'
import { useRef, useState, useEffect } from 'react'

import { Button } from '@heroui/react'
import { useCart } from '@/modules/cart/cart-store'
import { CartItemRow } from '@/modules/cart/cart-item-row'

import { useAuth } from '@/modules/auth/auth-store'
import { ShoppingCartIcon, Trash2Icon } from '@/components/ui/icons'

import { useCartCheckout } from './_use-cart-checkout'
import { CartEmptyState } from './_cart-empty-state'
import { CartInvoiceSummary } from './_cart-invoice-summary'
import { CheckoutConfirmModal } from './_checkout-confirm-modal'

export function CartView() {
  const {
    items,
    warehouse,
    itemCount,
    quantitySummary,
    subtotal,
    discountAmount,
    finalTotal,
    hasBlockingIssues,
    clearCart,
  } = useCart()

  const { user, isAuthenticated } = useAuth()
  const isOrderingDisabled = Boolean(user?.disableOrdering) || Boolean(user?.hideExactStock)

  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false)
  const [orderNotes, setOrderNotes, discardNotes] = useTextDraft<string>(user?.id ?? '', 'cart-notes', '')

  const { handleCheckoutSubmit, isSubmitting } = useCartCheckout({
    items,
    warehouse,
    hasBlockingIssues,
    user,
    isAuthenticated,
    orderNotes,
    discardNotes,
    onSubmitted: () => setIsCheckoutModalOpen(false),
  })

  const entryChecked = useRef(false)
  useEffect(() => {
    if (!items.length || entryChecked.current) return
    entryChecked.current = true
    void selectionStore.revalidate()
  }, [items.length])

  return (
    <div className="w-full px-3 py-3 space-y-3">
      <WarehouseSummary />
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-foreground flex items-center gap-1.5">
            <ShoppingCartIcon size={20} className="text-primary" />
            <span>سبد خرید</span>
          </h1>
          <p className="text-xs text-muted mt-1">
            بررسی اقلام و تکمیل سفارش
          </p>
        </div>

        {items.length > 0 && (
          <Button
            type="button"
            onPress={() => { clearCart(); setOrderNotes(''); discardNotes() }}
            className="text-xs font-semibold text-danger hover:text-danger/80 flex items-center gap-1 cursor-pointer active:scale-95 transition-transform"
          >
            <Trash2Icon size={13} />
            <span>خالی کردن</span>
          </Button>
        )}
      </div>

      {/* Main Cart Content */}
      {items.length === 0 ? (
        <CartEmptyState />
      ) : (
        <div className="flex flex-col gap-3">
          {/* Cart Items List */}
          <div className="space-y-2">
            {items.map((item) => (
              <CartItemRow key={item.productId} item={item} />
            ))}
          </div>

          {/* Invoice Summary Card */}
          <CartInvoiceSummary
            itemsLength={items.length}
            itemCount={itemCount}
            quantitySummary={quantitySummary}
            subtotal={subtotal}
            discountAmount={discountAmount}
            finalTotal={finalTotal}
            hasBlockingIssues={hasBlockingIssues}
            isOrderingDisabled={isOrderingDisabled}
            onOpenCheckout={() => setIsCheckoutModalOpen(true)}
          />
        </div>
      )}

      {/* Checkout Confirmation Modal (Bottom Sheet on Mobile) */}
      <CheckoutConfirmModal
        isOpen={isCheckoutModalOpen}
        onClose={() => setIsCheckoutModalOpen(false)}
        user={user}
        orderNotes={orderNotes}
        onOrderNotesChange={setOrderNotes}
        finalTotal={finalTotal}
        isSubmitting={isSubmitting}
        onSubmit={handleCheckoutSubmit}
      />
    </div>
  )
}
