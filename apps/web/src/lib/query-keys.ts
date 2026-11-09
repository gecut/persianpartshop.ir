/**
 * Centralized Query Keys & Mutation Keys Factory for TanStack Query.
 * All queries and mutations across the application MUST use these keys.
 */

export const queryKeys = {
  products: {
    all: ['products'] as const,
    catalog: (owner: string) => ['products', 'catalog', owner] as const,
    browse: (owner: string, filters: unknown) => ['products', 'browse', owner, filters] as const,
    browses: (owner: string) => ['products', 'browse', owner] as const,
    facets: (owner: string) => ['products', 'facets', owner] as const,
    lists: () => [...queryKeys.products.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) =>
      filters ? ([...queryKeys.products.lists(), filters] as const) : queryKeys.products.lists(),
    details: () => [...queryKeys.products.all, 'detail'] as const,
    detail: (id: string | number) => [...queryKeys.products.details(), String(id)] as const,
    dimensions: () => [...queryKeys.products.all, 'dimensions'] as const,
  },
  orders: {
    all: ['orders'] as const,
    lists: () => [...queryKeys.orders.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) =>
      filters ? ([...queryKeys.orders.lists(), filters] as const) : queryKeys.orders.lists(),
    details: () => [...queryKeys.orders.all, 'detail'] as const,
    detail: (id: string | number, owner = '') => [...queryKeys.orders.details(), String(id), owner] as const,
    summary: () => [...queryKeys.orders.all, 'summary'] as const,
  },
  supplyRequests: {
    all: ['supply-requests'] as const,
    lists: (owner: string) => ['supply-requests', owner, 'list'] as const,
    preview: (owner: string, productId: number, quantity: number) => ['supply-requests', owner, 'preview', productId, quantity] as const,
    list: (owner: string, page: number) => ['supply-requests', owner, 'list', page] as const,
    detail: (owner: string, id: number) => ['supply-requests', owner, 'detail', id] as const,
  },
  activityFeed: {
    all: ['activity-feed'] as const,
    list: (filter?: string, orderStatus?: string, owner = '') => ['activity-feed', 'list', owner, filter || 'all', orderStatus || ''] as const,
  },
  plans: {
    all: ['plans'] as const,
    lists: () => [...queryKeys.plans.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) =>
      filters ? ([...queryKeys.plans.lists(), filters] as const) : queryKeys.plans.lists(),
    detail: (id: string | number) => [...queryKeys.plans.all, 'detail', String(id)] as const,
    customers: () => [...queryKeys.plans.all, 'customers'] as const,
  },
  cart: {
    all: ['cart'] as const,
    validate: (items: unknown[]) => [...queryKeys.cart.all, 'validate', items] as const,
  },
  auth: {
    all: ['auth'] as const,
    session: (owner?: string | null) => [...queryKeys.auth.all, 'session', owner || 'anonymous'] as const,
    profile: (owner = '') => [...queryKeys.auth.all, 'profile', owner] as const,
  },
} as const

export const mutationKeys = {
  products: {
    calculateCartons: ['products', 'calculate-cartons'] as const,
  },
  orders: {
    submit: ['orders', 'submit'] as const,
    cancel: ['orders', 'cancel'] as const,
    prepareReorder: ['orders', 'prepare-reorder'] as const,
  },
  plans: {
    create: ['plans', 'create'] as const,
    update: ['plans', 'update'] as const,
  },
  auth: {
    requestOtp: ['auth', 'request-otp'] as const,
    verifyOtp: ['auth', 'verify-otp'] as const,
    updateProfile: ['auth', 'update-profile'] as const,
  },
  system: {
    csvPreview: ['system', 'csv-preview'] as const,
    csvApply: ['system', 'csv-apply'] as const,
  },
} as const
