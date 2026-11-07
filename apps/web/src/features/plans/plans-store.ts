import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api-client'
import type { Plan, B2BCustomer, Product } from '../../types'
import { formatPersianDate } from '../../lib/utils/date'
import { authStore, isProductAllowedForUser } from '../auth/auth-store'

const STORAGE_KEY = 'persianpart_plans_v1'


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

let currentPlans: Plan[] = []
// Personalized plans are fetched per session, never restored from a shared key.
try { localStorage.removeItem(STORAGE_KEY) } catch { /* Private storage may be unavailable. */ }
window.addEventListener('persianpart:account-change', () => { currentPlans = []; currentCustomers = []; broadcast() })
let currentCustomers: B2BCustomer[] = []
let isLoadingPlans = false
const listeners = new Set<() => void>()

function broadcast() {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }
  listeners.forEach((listener) => listener())
}

async function fetchFromBackend() {
  try {
    isLoadingPlans = true
    broadcast()
    const plansRes = await api.plan.list({ limit: 100 }).catch(() => null)

    if (plansRes && Array.isArray(plansRes.items)) {
      const mapped = plansRes.items
        .map(mapApiPlanToPlan)
        .filter((p) => p.isActive !== false)
      currentPlans = mapped
    }

    broadcast()
  } catch (err) {
    console.error('Error fetching plans:', err)
  } finally {
    isLoadingPlans = false
    broadcast()
  }
}

export const plansStore = {
  getPlans: () => {
    return currentPlans.filter((p) => p.isActive !== false)
  },
  getCustomers: () => currentCustomers,
  getProducts: () => [] as Product[],
  isLoading: () => isLoadingPlans,

  refresh: () => fetchFromBackend(),

  togglePlanStatus: async (planId: string) => {
    const plan = currentPlans.find((p) => p.id === planId)
    if (!plan) return

    const nextActive = !plan.isActive
    const now = Date.now()
    const isExpired = Boolean(
      plan.isExpired || (plan.expiresAt && new Date(plan.expiresAt).getTime() <= now)
    )
    const nextStatus = isExpired ? 'expired' : (nextActive ? 'active' : 'expired')

    currentPlans = currentPlans.map((p) =>
      p.id === planId ? { ...p, isActive: nextActive, isExpired, status: nextStatus } : p
    )
    broadcast()

    if (!planId.startsWith('plan-')) {
      try {
        await api.plan.update({
          id: Number(planId) || planId,
          isActive: nextActive,
        })
      } catch (err) {
        console.error('Failed to sync toggle with API:', err)
      }
    }
  },

  savePlan: async (data: Omit<Plan, 'id' | 'createdAt'> & { id?: string }) => {
    const customer = currentCustomers.find((c) => c.id === data.customerId)
    const customerName = customer ? `${customer.name} (${customer.company})` : data.customerName

    let backendId = data.id
    const isActive = data.isActive !== false

    try {
      if (data.id && !data.id.startsWith('plan-')) {
        await api.plan.update({
          id: Number(data.id) || data.id,
          title: data.title,
          users: data.customerId ? [Number(data.customerId) || data.customerId] : undefined,
          content: data.content || data.notes || '',
          type: data.type || 'credit_terms',
          isActive,
          products: data.productIds?.map(Number).filter(Boolean),
          hasTimer: Boolean(data.hasTimer),
          expiresAt: data.expiresAt,
        })
      } else {
        const created: any = await api.plan.create({
          title: data.title,
          users: data.customerId ? [Number(data.customerId) || data.customerId] : [2],
          content: data.content || data.notes || 'طرح ویژه',
          type: data.type || 'credit_terms',
          isActive,
          products: data.productIds?.map(Number).filter(Boolean),
          hasTimer: Boolean(data.hasTimer),
          expiresAt: data.expiresAt,
        })
        if (created?.id) {
          backendId = String(created.id)
        }
      }
    } catch (err) {
      console.error('Failed to persist plan via API:', err)
    }

    const now = Date.now()
    const isExpired = Boolean(
      data.expiresAt && new Date(data.expiresAt).getTime() <= now
    )
    const status = isExpired ? 'expired' : (isActive ? 'active' : 'expired')

    if (data.id) {
      currentPlans = currentPlans.map((p) =>
        p.id === data.id
          ? {
              ...p,
              ...data,
              customerName,
              isActive,
              isExpired,
              status,
            }
          : p
      )
    } else {
      const newPlan: Plan = {
        id: backendId || `plan-${Date.now()}`,
        title: data.title,
        customerGreeting: data.customerGreeting,
        customerId: data.customerId,
        customerName,
        type: data.type || 'credit_terms',
        isActive,
        isExpired,
        status,
        content: data.content || '',
        productIds: data.productIds,
        notes: data.notes,
        hasTimer: Boolean(data.hasTimer),
        expiresAt: data.expiresAt,
        createdAt: formatPersianDate(new Date()),
      }
      currentPlans = [newPlan, ...currentPlans]
    }

    broadcast()
  },

  deletePlan: (planId: string) => {
    currentPlans = currentPlans.filter((p) => p.id !== planId)
    broadcast()
  },

  resetToDefault: () => {
    currentPlans = []
    broadcast()
    fetchFromBackend()
  },
}

import { queryKeys, mutationKeys } from '../../lib/query-keys'

export function usePlans() {
  const queryClient = useQueryClient()

  const { data: plansData = plansStore.getPlans(), isLoading: isLoadingPlans, error, isFetching, refetch: refetchPlans } = useQuery<Plan[]>({
    queryKey: queryKeys.plans.list(),
    queryFn: async () => {
      const res = await api.plan.list({})
      if (res && Array.isArray(res.items)) {
        const mapped = res.items.map(mapApiPlanToPlan)
        currentPlans = mapped
        broadcast()
        return mapped
      }
      return plansStore.getPlans()
    },
    staleTime: 60 * 1000,
  })

  const customers = plansStore.getCustomers()

  const toggleMutation = useMutation({
    mutationKey: mutationKeys.plans.update,
    mutationFn: async (id: string) => {
      plansStore.togglePlanStatus(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plans.all })
    },
  })

  const saveMutation = useMutation({
    mutationKey: mutationKeys.plans.create,
    mutationFn: async (plan: Plan) => {
      plansStore.savePlan(plan)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plans.all })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      plansStore.deletePlan(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plans.all })
    },
  })

  const allProducts = useMemo(() => plansStore.getProducts(), [])

  return {
    plans: plansData,
    customers,
    allProducts,
    isLoading: isLoadingPlans,
    error,
    isFetching,
    refresh: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plans.all })
      return refetchPlans()
    },
    togglePlanStatus: (id: string) => toggleMutation.mutate(id),
    savePlan: (plan: Plan) => saveMutation.mutate(plan),
    deletePlan: (id: string) => deleteMutation.mutate(id),
    resetToDefault: plansStore.resetToDefault,
    getProductById: (id: string) => allProducts.find((p) => p.id === id),
    getCustomerById: (id: string) => customers.find((c) => c.id === id),
  }
}
