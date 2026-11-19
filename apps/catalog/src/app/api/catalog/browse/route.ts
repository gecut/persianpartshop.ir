import { PayloadSDKError } from '@payloadcms/sdk'
import { catalogOperations } from '@persianpart/contract/public-catalog'
import { readCatalogCMS, isCatalogNotFound } from '@/lib/catalog-cms'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'no-store' }
export async function POST(request: Request) {
  const reader = request.body?.getReader()
  let body = '',
    size = 0
  const decoder = new TextDecoder()
  if (reader)
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > 65536) {
        await reader.cancel()
        return new Response(null, { status: 413, headers })
      }
      body += decoder.decode(chunk.value, { stream: true })
    }
  body += decoder.decode()
  let raw: unknown
  try {
    raw = JSON.parse(body)
  } catch {
    return new Response(null, { status: 400, headers })
  }
  const parsed = catalogOperations.browse.input.safeParse(raw)
  if (!parsed.success) return new Response(null, { status: 400, headers })
  try {
    // Browser Authorization/cookies never become the CMS service identity.
    return Response.json(
      await readCatalogCMS('browse', parsed.data, {
        cache: 'no-store',
        signal: request.signal,
      }),
      { headers },
    )
  } catch (error) {
    const status = isCatalogNotFound(error)
      ? 404
      : error instanceof PayloadSDKError && error.status === 400
        ? 400
        : 503
    return Response.json(
      { error: 'دریافت کاتالوگ ممکن نشد؛ دوباره تلاش کنید.' },
      { status, headers },
    )
  }
}
