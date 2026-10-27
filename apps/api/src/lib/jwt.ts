import { sign, verify, decode } from 'hono/jwt'
import type { SignatureAlgorithm } from 'hono/utils/jwt/jwa'

const DEV_FALLBACK_SECRET = 'persianpart_jwt_auth_secret_key_production_2026_super_secure'

function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.PAYLOAD_SECRET
  if (process.env.NODE_ENV === 'production') {
    if (!secret || secret === DEV_FALLBACK_SECRET || secret.includes('dev-secret')) {
      throw new Error('FATAL: A secure JWT_SECRET or PAYLOAD_SECRET environment variable is required in production.')
    }
    return secret
  }
  return secret || DEV_FALLBACK_SECRET
}

export const JWT_SECRET = resolveJwtSecret()

export const JWT_ALGORITHM: SignatureAlgorithm = 'HS256'
export const JWT_ISSUER = 'persianpart.shop'
export const JWT_AUDIENCE = 'persianpart-client'
export const JWT_DEFAULT_EXPIRY_SECONDS = 30 * 24 * 60 * 60 // 30 days

export interface UserJwtPayload {
  sub: string
  phone?: string
  fullName?: string
  role?: string
  email?: string
  iat?: number
  exp?: number
  iss?: string
  aud?: string
  [key: string]: unknown
}

/**
 * Generates a signed JWT token for a user using Hono's native JWT engine
 */
export async function generateToken(
  user: {
    id: string | number
    phone?: string
    fullName?: string
    role?: string
    email?: string
  },
  expiresInSeconds: number = JWT_DEFAULT_EXPIRY_SECONDS
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  const payload: UserJwtPayload = {
    sub: String(user.id),
    phone: user.phone || '',
    fullName: user.fullName || '',
    role: user.role || 'customer',
    email: user.email || '',
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE,
    iat: now,
    exp: now + expiresInSeconds,
  }

  return await sign(payload, JWT_SECRET, JWT_ALGORITHM)
}

/**
 * Verifies a JWT token using Hono's native verify helper
 * Validates expiration (exp), issue time (iat), and cryptographic signature
 */
export async function verifyToken(token: string): Promise<UserJwtPayload | null> {
  if (!token || typeof token !== 'string') return null

  try {
    const verified = await verify(token, JWT_SECRET, JWT_ALGORITHM)
    return verified as unknown as UserJwtPayload
  } catch (err) {
    // Token is expired, signature is mismatched, or token format is invalid
    return null
  }
}

/**
 * Decodes header and payload of a token without verifying signature
 */
export function decodeToken(token: string): { header: any; payload: any } | null {
  if (!token) return null
  try {
    return decode(token)
  } catch {
    return null
  }
}

/**
 * Extracts the Bearer token string from an Authorization header (lightweight vanilla JS)
 */
export function extractBearerToken(headers: Headers | string | null | undefined): string | null {
  const val = (typeof headers === 'string' ? headers : headers?.get?.('authorization'))?.trim()
  return val?.toLowerCase().startsWith('bearer ') ? val.slice(7).trim() || null : null
}

// In-memory revocation store with expiration timestamp (in seconds)
const revokedTokens = new Map<string, number>()

/**
 * Revokes a token by adding it to the server-side revocation registry
 */
export function revokeToken(token: string, expiresAt?: number): void {
  if (!token) return
  const now = Math.floor(Date.now() / 1000)
  const exp = expiresAt || (now + JWT_DEFAULT_EXPIRY_SECONDS)
  revokedTokens.set(token, exp)

  // Prune expired entries periodically when map exceeds threshold
  if (revokedTokens.size > 1000) {
    for (const [key, timestamp] of revokedTokens.entries()) {
      if (now > timestamp) {
        revokedTokens.delete(key)
      }
    }
  }
}

/**
 * Checks whether a token has been revoked / logged out
 */
export function isTokenRevoked(token: string): boolean {
  if (!token) return false
  const exp = revokedTokens.get(token)
  if (!exp) return false
  const now = Math.floor(Date.now() / 1000)
  if (now > exp) {
    revokedTokens.delete(token)
    return false
  }
  return true
}
