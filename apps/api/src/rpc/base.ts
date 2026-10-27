import { implement, ORPCError } from '@orpc/server'
import { appContract } from '@persianpart/contract'
import type { Context, UserContext } from './context'

export const base = implement(appContract).$context<Context>()

export interface AuthenticatedUserContext extends UserContext {
  id: string | number
  role: string
}

export interface AuthenticatedContext extends Context {
  user: AuthenticatedUserContext
}

/**
 * Reusable Auth Middleware: ensures user is present and authenticated
 */
export const requireAuth = base.middleware(async ({ context, next }) => {
  if (!context.user) {
    throw new ORPCError('UNAUTHORIZED', {
      message: 'برای انجام این عملیات ابتدا باید وارد حساب کاربری خود شوید.',
    })
  }

  const user = context.user
  return next({
    context: {
      user,
    },
  })
})

/**
 * Reusable Admin Middleware: ensures user is authenticated and has administrative role
 */
export const requireAdmin = base.middleware(async ({ context, next }) => {
  if (!context.user) {
    throw new ORPCError('UNAUTHORIZED', {
      message: 'برای انجام این عملیات ابتدا باید وارد حساب کاربری خود شوید.',
    })
  }

  if (context.user.role !== 'admin' && context.user.role !== 'superadmin') {
    throw new ORPCError('FORBIDDEN', {
      message: 'دسترسی به این بخش منحصراً برای مدیران سیستم مجاز است.',
    })
  }

  const user = context.user
  return next({
    context: {
      user,
    },
  })
})

/**
 * Reusable Customer Middleware: ensures user is authenticated and has customer role
 */
export const requireCustomer = base.middleware(async ({ context, next }) => {
  if (!context.user) {
    throw new ORPCError('UNAUTHORIZED', {
      message: 'برای انجام این عملیات ابتدا باید وارد حساب کاربری خود شوید.',
    })
  }

  if (context.user.role !== 'customer') {
    throw new ORPCError('FORBIDDEN', {
      message: 'این عملیات منحصراً برای حساب‌های کاربری مشتریان فعال است.',
    })
  }

  const user = context.user
  return next({
    context: {
      user,
    },
  })
})

/**
 * Shared pre-configured implementers with middleware applied (DRY)
 */
export const authed = base.use(requireAuth)
export const adminOnly = base.use(requireAdmin)
export const customerOnly = base.use(requireCustomer)


