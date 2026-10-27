import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api-client'
import type { Plan, B2BCustomer, Product } from '../../types'
import { formatPersianDate } from '../../lib/utils/date'

const STORAGE_KEY = 'persianpart_plans_v1'

function getInitialPlans(): Plan[] {
  if (typeof window === 'undefined') return []
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) {
        const mapped = parsed
          .filter((p) => !p.id?.startsWith('demo-'))
          .map((p) => {
            const mapped = { ...p }
            if (mapped.createdAt && (mapped.createdAt.includes('2026') || mapped.createdAt.includes('2025') || mapped.createdAt.includes('2024') || mapped.createdAt.startsWith('20'))) {
              mapped.createdAt = formatPersianDate(mapped.createdAt)
            }
            if (mapped.hasTimer === undefined) {
              mapped.hasTimer = true
            }
            if (!mapped.expiresAt) {
              const seed = (mapped.id || mapped.title || '1').split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0)
              const hours = ((seed * 19) % 65) + 14
              mapped.expiresAt = new Date(Date.now() + hours * 3600 * 1000).toISOString()
            }
            return mapped
          })
        return mapped
      }
    }
  } catch {
    // fallback
  }
  return []
}

function mapApiPlanToPlan(p: any): Plan {
  const firstUser = Array.isArray(p.users) && p.users.length > 0 ? p.users[0] : null
  const customerName = firstUser
    ? (firstUser.fullName || firstUser.companyName || firstUser.phone || 'کاربر')
    : 'عمومی'
  const customerId = firstUser ? String(firstUser.id) : ''
  const isActive = p.status === 'active'

  const productIds = Array.isArray(p.products)
    ? p.products.map((prod: any) =>
        typeof prod === 'object' && prod !== null ? String(prod.id) : String(prod)
      )
    : []

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
    discountPercent: p.discountPercent != null ? Number(p.discountPercent) : undefined,
    discountAmount: p.discountAmount != null ? Number(p.discountAmount) : undefined,
    isActive,
    status: p.status || (isActive ? 'active' : 'expired'),
    content,
    productIds,
    notes: content,
    hasTimer: Boolean(p.hasTimer),
    expiresAt: p.expiresAt || p.expires_at || undefined,
    createdAt: p.createdAt ? formatPersianDate(p.createdAt) : formatPersianDate(new Date()),
  }
}

let currentPlans: Plan[] = getInitialPlans()
let currentCustomers: B2BCustomer[] = []
let isLoadingPlans = false
const listeners = new Set<() => void>()

function broadcast() {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentPlans))
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
    const [plansRes, usersRes] = await Promise.allSettled([
      api.plan.list({}),
      api.user.list({ limit: 100 }),
    ])

    if (plansRes.status === 'fulfilled' && plansRes.value?.items) {
      const mapped = plansRes.value.items.map(mapApiPlanToPlan)
      if (mapped.length > 0) {
        currentPlans = mapped
      }
    }

    if (usersRes.status === 'fulfilled' && Array.isArray(usersRes.value)) {
      currentCustomers = usersRes.value.map((u: any) => ({
        id: String(u.id),
        name: u.fullName || u.phone || `کاربر #${u.id}`,
        company: u.companyName || 'فروشگاه / همکار',
        phone: u.phone || '',
        tier: 'تجاری ممتاز' as const,
      }))
    }

    broadcast()
  } catch (err) {
    console.error('Error fetching plans/users:', err)
  } finally {
    isLoadingPlans = false
    broadcast()
  }
}

export const plansStore = {
  getPlans: () => currentPlans,
  getCustomers: () => currentCustomers,
  getProducts: () => [] as Product[],
  isLoading: () => isLoadingPlans,

  refresh: () => fetchFromBackend(),

  togglePlanStatus: async (planId: string) => {
    const plan = currentPlans.find((p) => p.id === planId)
    if (!plan) return

    const nextActive = !plan.isActive
    const nextStatus = nextActive ? 'active' : 'expired'

    currentPlans = currentPlans.map((p) =>
      p.id === planId ? { ...p, isActive: nextActive, status: nextStatus } : p
    )
    broadcast()

    if (!planId.startsWith('plan-')) {
      try {
        await api.plan.update({
          id: Number(planId) || planId,
          status: nextStatus,
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

    try {
      if (data.id && !data.id.startsWith('plan-')) {
        await api.plan.update({
          id: Number(data.id) || data.id,
          title: data.title,
          users: data.customerId ? [Number(data.customerId) || data.customerId] : undefined,
          content: data.content || data.notes || '',
          type: data.type || 'credit_terms',
          discountPercent: data.discountPercent,
          discountAmount: data.discountAmount,
          status: (data.status as any) || (data.isActive ? 'active' : 'expired'),
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
          discountPercent: data.discountPercent,
          discountAmount: data.discountAmount,
          status: (data.status as any) || (data.isActive ? 'active' : 'expired'),
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

    if (data.id) {
      currentPlans = currentPlans.map((p) =>
        p.id === data.id
          ? {
              ...p,
              ...data,
              customerName,
              status: data.status || (data.isActive ? 'active' : 'expired'),
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
        discountPercent: data.discountPercent,
        discountAmount: data.discountAmount,
        isActive: data.isActive,
        status: data.status || (data.isActive ? 'active' : 'expired'),
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

  const { data: plansData = plansStore.getPlans(), isLoading: isLoadingPlans, refetch: refetchPlans } = useQuery<Plan[]>({
    queryKey: queryKeys.plans.list(),
    queryFn: async () => {
      const res = await api.plan.list({})
      if (res?.items && res.items.length > 0) {
        const mapped = res.items.map(mapApiPlanToPlan)
        currentPlans = mapped
        broadcast()
        return mapped
      }
      return plansStore.getPlans()
    },
    staleTime: 60 * 1000,
  })

  const { data: customers = plansStore.getCustomers() } = useQuery<B2BCustomer[]>({
    queryKey: queryKeys.plans.customers(),
    queryFn: async () => {
      const res = await api.user.list({ limit: 100 })
      if (Array.isArray(res)) {
        const mapped: B2BCustomer[] = res.map((u: any) => ({
          id: String(u.id),
          name: u.fullName || u.phone || `کاربر #${u.id}`,
          company: u.companyName || 'فروشگاه / همکار',
          phone: u.phone || '',
          tier: 'تجاری ممتاز' as const,
        }))
        currentCustomers = mapped
        return mapped
      }
      return plansStore.getCustomers()
    },
    staleTime: 5 * 60 * 1000,
  })

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
