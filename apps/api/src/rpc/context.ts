import { extractBearerToken, verifyToken, isTokenRevoked, type UserJwtPayload } from '../lib/jwt'
import { sdk } from '../payload'
import type { User } from '@persianpart/cms/types'

export interface UserContext {
  id: string | number
  phone?: string
  fullName?: string
  email?: string
  role?: string
}

export interface Context {
  accountDocument?: User
  user: UserContext | null
  jwtPayload: UserJwtPayload | null
  req: Request
  authUnavailable?: boolean
  isBanned?: boolean
  banReason?: string | null
}

export async function createContext(req: Request): Promise<Context> {
  const token = extractBearerToken(req.headers)

  if (token) {
    // 1. Check if token was invalidated via logout
    if (isTokenRevoked(token)) {
      return {
        user: null,
        jwtPayload: null,
        req,
      }
    }

    // 2. Cryptographic signature and expiration check
    const payload = await verifyToken(token)

    if (payload && payload.sub) {
      const id = isNaN(Number(payload.sub)) ? payload.sub : Number(payload.sub)

      // 3. Database check: verify that the user actually exists and is active
      try {
        let userDoc: any = null

        if (payload.role === 'admin' || payload.role === 'superadmin') {
          userDoc = await sdk.findByID({ collection: 'admins', id })
        } else {
          userDoc = await sdk.findByID({ collection: 'users', id, depth: 1 })
        }

        if (userDoc) {
          const isBanned = userDoc.isBanned === true || userDoc.status === 'suspended'
          if (isBanned) {
            return {
              user: null,
              jwtPayload: payload,
              req,
              isBanned: true,
              banReason: userDoc.banReason || null,
            }
          }

          const isInactive = userDoc.isActive === false
          if (!isInactive) {
            return {
              accountDocument: payload.role !== 'admin' && payload.role !== 'superadmin' ? userDoc : undefined,
              user: {
                id: userDoc.id ?? id,
                phone: userDoc.phone || payload.phone,
                fullName: userDoc.fullName || userDoc.name || payload.fullName,
                email: userDoc.email || payload.email,
                role: userDoc.role || payload.role || 'customer',
              },
              jwtPayload: payload,
              req,
            }
          }
        }
      } catch (error) {
        // A missing account invalidates the session; a service failure does not.
        if (!(error && typeof error === 'object' && 'status' in error && error.status === 404)) {
          return { user: null, jwtPayload: payload, req, authUnavailable: true }
        }
      }
    }
  }

  return {
    user: null,
    jwtPayload: null,
    req,
  }
}
