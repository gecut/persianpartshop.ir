import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, type ValidateCartOutput } from '../lib/api-client'
import { queryKeys } from '../lib/query-keys'

export interface CartItemDraft {
  productId: string
  requestedSqm: number
}

const CART_STORAGE_KEY = 'persianpart_cart'

export function useCart() {
  const [items, setItems] = useState<CartItemDraft[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(CART_STORAGE_KEY)
        return saved ? JSON.parse(saved) : []
      } catch {
        return []
      }
    }
    return []
  })

  // Save to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
    }
  }, [items])

  // Validate cart against server pricing engine using TanStack Query
  const {
    data: validation = null,
    isLoading: isValidating,
    refetch: refreshValidation,
  } = useQuery({
    queryKey: queryKeys.cart.validate(items),
    queryFn: async (): Promise<ValidateCartOutput | null> => {
      if (items.length === 0) return null
      try {
        return await api.order.pricing.validateCart({ items })
      } catch {
        return null
      }
    },
    enabled: items.length > 0,
    staleTime: 10 * 1000,
  })

  const addItem = (productId: string, requestedSqm: number) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === productId)
      if (existing) {
        return prev.map((i) =>
          i.productId === productId ? { ...i, requestedSqm: i.requestedSqm + requestedSqm } : i
        )
      }
      return [...prev, { productId, requestedSqm }]
    })
  }

  const updateItemQuantity = (productId: string, requestedSqm: number) => {
    if (requestedSqm <= 0) {
      removeItem(productId)
      return
    }
    setItems((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, requestedSqm } : i))
    )
  }

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId))
  }

  const clearCart = () => {
    setItems([])
  }

  return {
    items,
    validation,
    isValidating,
    totalAmount: validation?.totalAmount || 0,
    totalSqm: validation?.totalSqm || 0,
    totalCartons: validation?.totalCartons || 0,
    isValid: validation?.isValid ?? false,
    errorReasons: validation?.errorReasons || [],
    addItem,
    updateItemQuantity,
    removeItem,
    clearCart,
    refreshValidation,
  }
}
