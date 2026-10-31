import path from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'
import { Hono } from 'hono'
import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { trimTrailingSlash } from 'hono/trailing-slash'
import { jwt } from 'hono/jwt'
import { handler } from './rpc/handler'
import { createContext } from './rpc/context'
import { JWT_SECRET } from './lib/jwt'

const PORT = Number(process.env.PORT) || 5175
const HOSTNAME = process.env.HOST || '0.0.0.0'
const CMS_ORIGIN = process.env.CMS_URL || 'http://localhost:5174'
const CDN_URL = (process.env.CDN_URL || '').replace(/\/+$/, '')

// Canonical Media Storage Directory (Single Source of Truth for Nginx & API)
export const MEDIA_DIR = process.env.MEDIA_DIR
  ? path.resolve(process.env.MEDIA_DIR)
  : path.resolve(import.meta.dir, '../../cms/media')

if (!existsSync(MEDIA_DIR)) {
  try {
    mkdirSync(MEDIA_DIR, { recursive: true })
  } catch (err) {
    console.warn(`[Media Server] Could not create MEDIA_DIR: ${MEDIA_DIR}`, err)
  }
}

// Initialize Hono Application
export const app = new Hono()

// Global Middlewares (Logger, Formatting, CORS)
app.use('*', logger())
app.use('*', prettyJSON())
app.use(trimTrailingSlash())
app.use(
  '*',
  cors({
    origin: (origin) => origin || '*',
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    maxAge: 86400,
  })
)

// 1. Health Checks
const healthHandler = (c: Context) => {
  return c.json({
    status: 'ok',
    framework: 'hono',
    runtime: 'bun',
    version: Bun.version,
    port: PORT,
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  })
}

app.get('/health', healthHandler)
app.get('/api/health', healthHandler)

// 2. Built-in Hono JWT Protected Endpoints
app.use(
  '/api/auth/me',
  jwt({
    secret: JWT_SECRET,
    alg: 'HS256',
  })
)

app.use(
  '/api/media/upload',
  jwt({
    secret: JWT_SECRET,
    alg: 'HS256',
  })
)

app.get('/api/auth/me', (c) => {
  const payload = c.get('jwtPayload')
  return c.json({
    status: 'authenticated',
    user: payload,
  })
})

// 3. Media Upload Endpoint (Uploads to Payload CMS media collection)
app.post('/api/media/upload', async (c) => {
  try {
    const formData = await c.req.parseBody()
    const file = formData['file']
    if (!file || !(file instanceof File)) {
      return c.json({ error: 'فایل معتبری برای آپلود ارسال نشده است (پارامتر file).' }, 400)
    }

    const MAX_FILE_SIZE = 15 * 1024 * 1024 // 15MB
    if (file.size > MAX_FILE_SIZE) {
      return c.json({ error: 'حجم فایل بیش از حد مجاز است (حداکثر ۱۵ مگابایت).' }, 400)
    }

    // Sanitize extension and filename
    const ext = path.extname(file.name).toLowerCase()
    const safeExts = ['.jpg', '.jpeg', '.png', '.webp', '.svg', '.gif', '.avif', '.pdf']
    if (!safeExts.includes(ext)) {
      return c.json({ error: `فرمت فایل مجاز نیست. فرمت‌های مجاز: ${safeExts.join(', ')}` }, 400)
    }

    const cmsUrl = process.env.CMS_URL || 'http://localhost:5174'
    const cmsApiKey = process.env.CMS_API_KEY || 'persianpart_dev_api_key_2026'

    const cmsFormData = new FormData()
    const alt = (formData['alt'] as string) || file.name || 'document'
    cmsFormData.append('_payload', JSON.stringify({ alt }))
    cmsFormData.append('file', file)

    const cmsResponse = await fetch(`${cmsUrl}/api/media`, {
      method: 'POST',
      headers: {
        Authorization: `admins API-Key ${cmsApiKey}`,
      },
      body: cmsFormData,
    })

    if (!cmsResponse.ok) {
      const errText = await cmsResponse.text()
      console.error('[CMS Media Upload Error]:', cmsResponse.status, errText)
      return c.json({ error: 'خطا در بارگذاری فایل در سامانه رسانه‌ها' }, 500)
    }

    const result: any = await cmsResponse.json()
    const doc = result.doc || result

    return c.json({
      success: true,
      id: doc.id,
      filename: doc.filename,
      url: doc.url,
      size: doc.filesize || file.size,
      mimeType: doc.mimeType || file.type,
    }, 201)
  } catch (err) {
    console.error('[Media Upload Error]:', err)
    return c.json({ error: 'خطا در ذخیره‌سازی فایل روی سرور' }, 500)
  }
})

// 4. Media Server (Fallback when Nginx is bypassed in local dev)
app.get('/api/media/*', async (c) => {
  const segments = c.req.path.split('/').filter(Boolean)
  const rawFilename = segments[segments.length - 1]
  if (!rawFilename) {
    return c.text('Bad Request', 400)
  }

  // Prevent path traversal attacks
  const filename = path.basename(decodeURIComponent(rawFilename))
  const filePath = path.join(MEDIA_DIR, filename)
  const file = Bun.file(filePath)

  if (await file.exists()) {
    return new Response(file, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
        'Content-Type': file.type || 'application/octet-stream',
      },
    })
  }

  // Fallback for static image assets in web/public
  const webPublicFallback = path.resolve(import.meta.dir, '../../web/public/assets/images', filename)
  const fallbackFile = Bun.file(webPublicFallback)
  if (await fallbackFile.exists()) {
    return new Response(fallbackFile, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
        'Content-Type': fallbackFile.type || 'application/octet-stream',
      },
    })
  }

  return c.text('File Not Found', 404)
})

// 3. oRPC Server Integration (/api/rpc/*)
const rpcHandler = async (c: Context) => {
  const { matched, response } = await handler.handle(c.req.raw, {
    prefix: '/api/rpc',
    context: async () => createContext(c.req.raw),
  })

  if (matched && response) {
    return response
  }

  return c.json({ error: 'Procedure Not Found' }, 404)
}

app.all('/api/rpc', rpcHandler)
app.all('/api/rpc/*', rpcHandler)

// 4. OpenAPI Forward Proxy to CMS (/api/openapi/*)
const openApiHandler = async (c: Context) => {
  const url = new URL(c.req.url)
  const targetUrl = new URL(url.pathname + url.search, CMS_ORIGIN)
  const forwardHeaders = new Headers(c.req.raw.headers)
  forwardHeaders.set('host', targetUrl.host)

  try {
    return await fetch(targetUrl.toString(), {
      method: c.req.method,
      headers: forwardHeaders,
      body:
        c.req.method !== 'GET' && c.req.method !== 'HEAD'
          ? await c.req.raw.arrayBuffer()
          : undefined,
    })
  } catch {
    return c.json({ error: 'OpenAPI not configured or CMS offline' }, 502)
  }
}

app.all('/api/openapi', openApiHandler)
app.all('/api/openapi/*', openApiHandler)



// 6. Global Error & 404 Handlers
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json(
      {
        error: err.message || 'Unauthorized',
        status: err.status,
      },
      err.status
    )
  }
  console.error('[Hono Server Error]:', err)
  return c.json(
    {
      error: 'Internal Server Error',
      message: err instanceof Error ? err.message : 'Unknown error',
    },
    500
  )
})

app.notFound((c) => {
  return c.json({ error: 'Route Not Found', path: c.req.path }, 404)
})

console.log(
  `🚀 PersianPart API running on http://${HOSTNAME === '0.0.0.0' ? 'localhost' : HOSTNAME}:${PORT} (Hono + Bun v${Bun.version})`
)

// Export for Bun's native HTTP server
export default {
  port: PORT,
  hostname: HOSTNAME,
  fetch: app.fetch,
}
