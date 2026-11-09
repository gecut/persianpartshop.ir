import { useMemo } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { Plan } from './plan-types'
import { formatPersianDate } from '@/lib/utils/date'
import { authStore, isProductAllowedForUser, useAuth } from '@/modules/auth/auth-store'

function mapApiPlanToPlan(p: any): Plan {
  const firstUser = Array.isArray(p.users) && p.users.length > 0 ? p.users[0] : null
  const customerName = firstUser
    ? (firstUser.fullName || firstUser.companyName || firstUser.phone || 'کاربر')
    : 'عمومی'
  const customerId = firstUser ? String(firstUser.id) : ''
  const now = Date.now()
  const isExpired = Boolean(p.isExpired || p.status === 'expired' || (p.expiresAt && new Date(p.expiresAt).getTime() <= now))
  const isActive = p.isActive !== false
  const status = isExpired ? 'expired' : (p.status || (isActive ? 'active' : 'expired'))

  const currentUser = authStore.getState().user
  let productsList = Array.isArray(p.products) ? p.products : []
  if (currentUser?.allowedCategoryIds && currentUser.allowedCategoryIds.length > 0) {
    productsList = productsList.filter((prod: any) => isProductAllowedForUser(prod, currentUser))
  }

  const productIds = productsList.map((prod: any) =>
    typeof prod === 'object' && prod !== null ? String(prod.id) : String(prod)
  )

  const interpolate = (txt: string) => {
    if (!txt) return ''
    return txt
      .replace(/\{\{\s*user\.name\s*\}\}/gi, customerName)
      .replace(/\{\{\s*name\s*\}\}/gi, customerName)
      .replace(/\{name\}/gi, customerName)
      .replace(/\[نام\s*کاربر\]/gi, customerName)
      .replace(/\[نام\s*مشتری\]/gi, customerName)
      .replace(/\[نام\]/gi, customerName)
  }

  const rawTitle = p.title || `${customerName} عزیز، این طرح برای شماست`
  const title = interpolate(rawTitle)
  let rawContent = p.content || p.notes || ''
  let content = interpolate(rawContent)
  if (customerName !== 'عمومی' && !content.includes(customerName) && content.trim() !== '') {
    content = `${customerName} عزیز؛ ${content}`
  }

  return {
    id: String(p.id),
    title,
    customerGreeting: p.dynamicTitle ? interpolate(p.dynamicTitle) : title,
    customerId,
    customerName,
    type: p.type || 'credit_terms',
    isActive,
    isExpired,
    status,
    content,
    productIds,
    notes: content,
    hasTimer: Boolean(p.hasTimer),
    startsAt: p.startsAt || p.starts_at || undefined,
    expiresAt: p.expiresAt || p.expires_at || undefined,
    products: productsList,
    createdAt: p.createdAt ? formatPersianDate(p.createdAt) : formatPersianDate(new Date()),
  }
}

import { queryKeys } from '@/lib/query-keys'
export function usePlans() {
  const { user } = useAuth()
  const query = useInfiniteQuery({
    queryKey: queryKeys.plans.list({ owner: user?.id ?? '', paginated: true }),
    queryFn: ({ pageParam, signal }) => api.plan.list({ page: pageParam, limit: 12 }, { signal }),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => last.hasMore ? pages.length + 1 : undefined,
    enabled: !!user,
    staleTime: 120_000,
  })
  const plans = useMemo(() => query.data?.pages.flatMap(page => page.items.map(mapApiPlanToPlan)) ?? [], [query.data, user])
  return { plans, isLoading: query.isPending, error: query.error, isFetching: query.isFetching, refresh: query.refetch, hasMore: !!query.hasNextPage, loadMore: () => { if (query.hasNextPage && !query.isFetching) void query.fetchNextPage() } }
}
