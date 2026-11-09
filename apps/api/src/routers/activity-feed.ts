import { ORPCError } from '@orpc/server'
import type { ActivityFeedOutput } from '@persianpart/contract'
import { customerOnly } from '../rpc/base'
import { sdk } from '../payload'

const list = customerOnly.activityFeed.list.handler(async ({ input, context }) => {
  const userId = Number(context.user.id)
  const user = await sdk.findByID({ collection: 'users', id: userId, depth: 0 })
  if (user.status !== 'active') throw new ORPCError('FORBIDDEN', { message: 'حساب مشتری فعال نیست.' })

  const cmsUrl = process.env.CMS_API_URL || `${(process.env.CMS_URL || 'http://localhost:5174').replace(/\/+$/, '')}/api`
  const params = new URLSearchParams()
  params.set('userId', String(userId))
  params.set('limit', String(input.limit))
  params.set('filter', input.filter)
  if (input.cursor) params.set('cursor', input.cursor)
  if (input.orderStatus) params.set('orderStatus', input.orderStatus)

  const headers: Record<string, string> = { Accept: 'application/json' }
  const apiKey = process.env.CMS_API_KEY || 'persianpart_dev_api_key_2026'
  headers['Authorization'] = `admins API-Key ${apiKey}`

  try {
    const response = await fetch(`${cmsUrl}/activity-feed?${params.toString()}`, { headers })
    if (!response.ok) {
      throw new ORPCError('INTERNAL_SERVER_ERROR', { message: 'دریافت فعالیت‌ها با خطا مواجه شد.' })
    }
    const data = (await response.json()) as ActivityFeedOutput
    return data
  } catch (err) {
    if (err instanceof ORPCError) throw err
    throw new ORPCError('INTERNAL_SERVER_ERROR', { message: 'ارتباط با سرویس اطلاعات فعالیت‌ها برقرار نشد.' })
  }
})

export const activityFeed = { list }
