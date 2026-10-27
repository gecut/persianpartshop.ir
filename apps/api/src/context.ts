export interface Context {
  headers: Headers
  ip?: string
  user?: {
    id: string
    role: string
    name?: string
  } | null
}

export async function createContext(request: Request): Promise<Context> {
  const forwardedFor = request.headers.get('x-forwarded-for')
  const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : undefined

  return {
    headers: request.headers,
    ip,
    user: null,
  }
}

