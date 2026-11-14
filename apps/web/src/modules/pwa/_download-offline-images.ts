import { offlineImageCache, offlineMediaKey, sharedOfflineImageCache, type OfflinePackage } from './offline-storage'
import type { OfflineProgress } from './_download-offline-data'

async function matchesMedia(response: Response, item: NonNullable<OfflinePackage['manifest']>['media'][number]) {
  const bytes = await response.arrayBuffer()
  if (bytes.byteLength !== item.bytes) return false
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  return hash === item.hash
}

export async function downloadOfflineImages(
  pack: OfflinePackage,
  previous: OfflinePackage | undefined,
  signal: AbortSignal,
  save: () => Promise<void>,
  report: (progress: OfflineProgress) => void,
) {
  const cache = await caches.open(pack.manifest ? sharedOfflineImageCache : offlineImageCache(pack.id))
  const oldCache = previous && await caches.has(offlineImageCache(previous.id))
    ? await caches.open(offlineImageCache(previous.id)) : undefined
  const expected = new Map(pack.manifest?.media.map(item => [new URL(item.path, location.origin).href, item]))
  const cacheKey = (url: string) => expected.has(url) ? offlineMediaKey(location.origin, expected.get(url)!.hash) : url
  let bytes = 0
  const reportImages = () => report({
    phase: 'images', done: Object.keys(pack.imageSizes).length,
    total: pack.images.length, reused: pack.reusedImages, bytes,
  })
  for (const url of Object.keys(pack.imageSizes)) {
    if (!await cache.match(cacheKey(url))) delete pack.imageSizes[url]
  }
  await save()
  reportImages()
  for (const url of pack.images) {
    signal.throwIfAborted()
    if (Object.hasOwn(pack.imageSizes, url)) continue
    const item = expected.get(url)
    const cached = item && await cache.match(cacheKey(url))
    if (cached && await matchesMedia(cached, item)) {
      pack.imageSizes[url] = item.bytes
      pack.reusedImages++
      await save()
      reportImages()
      continue
    }
    const request = new Request(url, {
      mode: 'cors', credentials: 'omit', redirect: 'error', cache: 'no-cache',
      signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
    })
    const old = await oldCache?.match(url)
    const etag = old?.headers.get('etag')
    const modified = old?.headers.get('last-modified')
    const headers = new Headers()
    if (etag) headers.set('If-None-Match', etag)
    else if (modified) headers.set('If-Modified-Since', modified)
    // Cross-origin validators require CORS preflight. Let the browser revalidate
    // its HTTP cache on those origins without requiring extra CDN headers.
    const target = new URL(url)
    const versioned = target.searchParams.has('v') || target.searchParams.has('version') ||
      /[-.][a-f0-9]{16,}\.[a-z]+$/i.test(target.pathname)
    const conditional = old && target.origin === location.origin && (etag || modified)
    const fetched = old && versioned ? undefined : await fetch(conditional ? new Request(request, { headers }) : request)
    const reused = !!old && (versioned || !!conditional && fetched?.status === 304)
    const response = reused ? old : fetched
    if (!response || response.status !== 200 || !/^image\/(?:jpeg|png|webp|avif|gif)(?:;|$)/i.test(response.headers.get('content-type') ?? '') ||
        /\bprivate\b|\bno-store\b/i.test(response.headers.get('cache-control') ?? '')) throw new Error('image')
    const blob = await response.clone().blob()
    if (item && !await matchesMedia(response.clone(), item)) throw new Error('image')
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(blob)
      bitmap.close()
    } else {
      const url = URL.createObjectURL(blob)
      try {
        const image = new Image()
        image.src = url
        await image.decode()
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    signal.throwIfAborted()
    await cache.put(cacheKey(url), response)
    if (signal.aborted) {
      if (!pack.manifest) await cache.delete(url)
      signal.throwIfAborted()
    }
    pack.imageSizes[url] = blob.size
    if (reused) pack.reusedImages++
    else bytes += blob.size
    await save()
    reportImages()
  }
}

export async function verifyOfflineAssets(pack: OfflinePackage, deep = false) {
  const missing = await missingOfflineImages(pack, deep)
  if (missing.length) throw new Error('image')
  await verifyOfflineShell()
}

export async function missingOfflineImages(pack: OfflinePackage, deep = false) {
  if (!pack.images.length) return []
  const name = pack.manifest ? sharedOfflineImageCache : offlineImageCache(pack.id)
  if (!await caches.has(name)) return pack.images
  const cache = await caches.open(name)
  const keys = new Set((await cache.keys()).map(request => request.url))
  if (!pack.manifest) return pack.images.filter(url => !keys.has(url))
  const missing: string[] = []
  for (const item of pack.manifest.media) {
    const key = offlineMediaKey(location.origin, item.hash)
    if (keys.has(key)) {
      if (!deep) continue
      const response = await cache.match(key)
      if (response && await matchesMedia(response, item)) continue
    }
    missing.push(new URL(item.path, location.origin).href)
  }
  return missing
}

async function verifyOfflineShell() {
  const controller = navigator.serviceWorker?.controller
  if (!controller) throw new Error('worker')
  await new Promise<void>((resolve, reject) => {
    const { port1, port2 } = new MessageChannel()
    const finish = (ok: boolean) => {
      clearTimeout(timer)
      port1.close()
      if (ok) resolve()
      else reject(new Error('worker'))
    }
    const timer = setTimeout(() => finish(false), 5_000)
    port1.onmessage = ({ data }) => finish(data === true && controller === navigator.serviceWorker.controller)
    controller.postMessage({ type: 'VERIFY_OFFLINE_SHELL' }, [port2])
  })
}
