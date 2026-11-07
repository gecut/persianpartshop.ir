import { implement, ORPCError } from '@orpc/server'
import { appContract } from '@persianpart/contract'
import type { Context, UserContext } from './context'

export const base = implement(appContract).$context<Context>().use(async ({ context, next }) => {
  if (context.authUnavailable) throw new ORPCError('SERVICE_UNAVAILABLE', { message: 'بررسی حساب موقتاً در دسترس نیست؛ دوباره تلاش کنید.' })
  return next()
})

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
  if (context.isBanned) {
    const reason = context.banReason ? ` به علت: «${context.banReason}»` : ''
    throw new ORPCError('FORBIDDEN', {
      message: `حساب کاربری شما توسط مدیریت مسدود گردید.${reason}`,
      data: {
        code: 'USER_BANNED',
        banned: true,
        reason: context.banReason || null,
      },
    })
  }

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


