/// <reference lib="webworker" />

import { cacheNames, setCacheNameDetails } from 'workbox-core'
import { CacheExpiration, ExpirationPlugin } from 'workbox-expiration'
import { createHandlerBoundToURL, matchPrecache, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { StaleWhileRevalidate } from 'workbox-strategies'
import { offlineImageCache, offlineMaxAge, publicImageUrl, readOfflineMedia } from './modules/pwa/offline-storage'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Parameters<typeof precacheAndRoute>[0] }
declare const __PWA_RELEASE__: string
declare const __PWA_CDN_ORIGIN__: string

const cachePrefix = 'persianpart'
const imageCachePrefix = `${cachePrefix}-catalog-images-`
const imageCache = imageCachePrefix + __PWA_RELEASE__
const imageExpiration = { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 }

// Installation fills a fresh precache while the old worker still serves its own.
setCacheNameDetails({ prefix: cachePrefix, suffix: __PWA_RELEASE__ })
const manifest = self.__WB_MANIFEST
precacheAndRoute(manifest)
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), {
  allowlist: [/^\/(?=\?|$)|^\/(?:product|cart|orders|plans|account|login)(?=[/?]|$)/],
  denylist: [/^[^?]*\.[a-z0-9]+(?=\?|$)/i, /^\/api(?=[/?]|$)/],
}))

const runtimeImages = new StaleWhileRevalidate({
  cacheName: imageCache,
  fetchOptions: { cache: 'reload' },
  plugins: [
    { cacheWillUpdate: async ({ response }) => response.status === 200 ? response : null },
    new ExpirationPlugin(imageExpiration),
  ],
})
registerRoute(
  ({ url, request, sameOrigin }) => request.destination === 'image' &&
    ((sameOrigin && url.pathname.startsWith('/assets/images/')) || !!publicImageUrl(url.href, self.location.origin, __PWA_CDN_ORIGIN__)),
  async ({ event, request, url }) => {
    try {
      const pack = await readOfflineMedia()
      if (pack?.completedAt && Date.now() < Math.min(pack.accessUntil, pack.completedAt + offlineMaxAge) &&
          Object.hasOwn(pack.imageSizes, url.href)) {
        const cached = await caches.match(url.href, { cacheName: offlineImageCache(pack.id) })
        if (cached) {
          if (!self.navigator.onLine) return cached
          const fresh = await fetch(request).catch(() => undefined)
          return fresh?.ok || fresh?.type === 'opaque' ? fresh : cached
        }
      }
    } catch { /* Fall back to the normal image request. */ }
    if (url.origin === self.location.origin && url.pathname.startsWith('/assets/images/')) {
      return runtimeImages.handle({ event, request })
    }
    return fetch(request)
  },
)

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting())
  if (event.data?.type === 'VERIFY_OFFLINE_SHELL' && event.ports[0]) {
    event.waitUntil((async () => {
      const urls = manifest.map(entry => typeof entry === 'string' ? entry : entry.url)
      const hasQr = urls.some(url => /\/zxing_reader-.*\.wasm$/.test(url)) &&
        urls.some(url => /\/product-qr-camera-.*\.js$/.test(url)) &&
        urls.some(url => /\/product-qr-download-.*\.js$/.test(url))
      for (const url of urls) {
        if (!await matchPrecache(url)) {
          event.ports[0]?.postMessage(false)
          return
        }
      }
      event.ports[0]?.postMessage(hasQr && !!await matchPrecache('/index.html'))
    })().catch(() => event.ports[0]?.postMessage(false)))
  }
})

self.addEventListener('activate', (event) => {
  event.waitUntil(purgeOldCaches())
})

async function purgeOldCaches() {
  const legacyPrecache = `workbox-precache-v2-${self.registration.scope}`
  const names = await caches.keys()
  await Promise.all(names.map(async (name) => {
    if (name === cacheNames.precache || name === imageCache) return

    const isImageCache = name.startsWith(imageCachePrefix) || name === 'catalog-images-v1'
    if (isImageCache) {
      await new CacheExpiration(name, imageExpiration).delete()
    }
    if (isImageCache || name.startsWith(`${cachePrefix}-precache-`) || name === legacyPrecache) {
      await caches.delete(name)
    }
  }))
  await self.clients.claim()
}
