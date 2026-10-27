import { ORPCError, os } from '@orpc/server'
import type { Context } from './context'

export const base = os.$context<Context>()

/**
 * Public procedure with timing/logging middleware
 */
export const publicProcedure = base.use(async ({ next, path }) => {
  const start = Date.now()
  try {
    const result = await next()
    const duration = Date.now() - start
    if (process.env.NODE_ENV === 'development') {
      console.log(`[oRPC] ${path.join('.')} executed in ${duration}ms`)
    }
    return result
  } catch (error) {
    const duration = Date.now() - start
    console.error(`[oRPC Error] ${path.join('.')} failed after ${duration}ms:`, error)
    throw error
  }
})

/**
 * Protected procedure requiring authenticated user
 */
export const authedProcedure = publicProcedure.use(async ({ context, next }) => {
  if (!context.user) {
    throw new ORPCError('UNAUTHORIZED', {
      message: 'شما مجاز به دسترسی به این بخش نیستید. لطفا ابتدا وارد شوید.',
    })
  }

  return next({
    context: {
      user: context.user,
    },
  })
})
