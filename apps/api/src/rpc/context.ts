import { extractBearerToken, verifyToken, isTokenRevoked, type UserJwtPayload } from '../lib/jwt'
import { sdk } from '../payload'

export interface UserContext {
  id: string | number
  phone?: string
  fullName?: string
  email?: string
  role?: string
}

export interface Context {
  user: UserContext | null
  jwtPayload: UserJwtPayload | null
  req: Request
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
          try {
            userDoc = await sdk.findByID({ collection: 'admins', id })
          } catch {
            userDoc = null
          }
        } else {
          userDoc = await sdk.findByID({ collection: 'users', id })
        }

        if (userDoc) {
          const isInactive = userDoc.status === 'suspended' || userDoc.isActive === false
          if (!isInactive) {
            return {
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
      } catch {
        // User lookup failed or db error - continue as guest
      }
    }
  }

  return {
    user: null,
    jwtPayload: null,
    req,
  }
}
