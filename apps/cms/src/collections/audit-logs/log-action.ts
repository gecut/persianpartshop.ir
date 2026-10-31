import type { Payload } from 'payload'

export interface LogActionParams {
  payload: Payload
  action:
    | 'admin_login'
    | 'product_create'
    | 'product_update'
    | 'product_delete'
    | 'user_create'
    | 'user_update'
    | 'user_ban'
    | 'user_unban'
    | 'user_delete'
    | 'admin_manage'
    | 'other'
  entity: 'products' | 'users' | 'admins' | 'auth' | 'orders'
  target: string
  details?: string
  req?: any
  adminId?: string | number | null
  adminName?: string | null
  ip?: string | null
}

export function getClientIp(req: any): string {
  if (!req) return ''
  if (req.headers) {
    if (typeof req.headers.get === 'function') {
      const forwarded = req.headers.get('x-forwarded-for')
      if (forwarded) return forwarded.split(',')[0].trim()
      const real = req.headers.get('x-real-ip')
      if (real) return real.trim()
    } else if (typeof req.headers === 'object') {
      const forwarded = req.headers['x-forwarded-for']
      if (forwarded) {
        return (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',')[0].trim()
      }
      const real = req.headers['x-real-ip']
      if (real) {
        return Array.isArray(real) ? real[0].trim() : real.trim()
      }
    }
  }
  return req.ip || ''
}

export async function logAction({
  payload,
  action,
  entity,
  target,
  details,
  req,
  adminId,
  adminName,
  ip,
}: LogActionParams) {
  try {
    const finalIp = ip || (req ? getClientIp(req) : '')
    const finalAdminId =
      adminId !== undefined
        ? adminId
        : req?.user?.collection === 'admins' || req?.user?.role
        ? req.user.id
        : null
    const finalAdminName =
      adminName ||
      (req?.user
        ? req.user.name || req.user.email || `مدیر #${req.user.id}`
        : 'سیستم')

    await payload.create({
      collection: 'audit-logs',
      data: {
        action,
        entity,
        target,
        details: details || '',
        admin: finalAdminId ? Number(finalAdminId) : null,
        adminName: finalAdminName,
        ip: finalIp,
      },
      req,
      context: { skipLogging: true },
    })
  } catch (err) {
    // Logging failure should not disrupt business flow
    console.error('Audit log write error:', err)
  }
}
