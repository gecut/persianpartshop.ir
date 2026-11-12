/// <reference lib="webworker" />

import { cacheNames, setCacheNameDetails } from 'workbox-core'
import { CacheExpiration, ExpirationPlugin } from 'workbox-expiration'
import { createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { StaleWhileRevalidate } from 'workbox-strategies'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Parameters<typeof precacheAndRoute>[0] }
declare const __PWA_RELEASE__: string
declare const __PWA_CDN_ORIGIN__: string

const cachePrefix = 'persianpart'
const imageCachePrefix = `${cachePrefix}-catalog-images-`
const imageCache = imageCachePrefix + __PWA_RELEASE__
const imageExpiration = { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 }

// Installation fills a fresh precache while the old worker still serves its own.
setCacheNameDetails({ prefix: cachePrefix, suffix: __PWA_RELEASE__ })
precacheAndRoute(self.__WB_MANIFEST)
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), {
  allowlist: [/^\/(?=\?|$)|^\/(?:product|cart|orders|plans|account|login)(?=[/?]|$)/],
  denylist: [/^[^?]*\.[a-z0-9]+(?=\?|$)/i, /^\/api(?=[/?]|$)/],
}))

registerRoute(
  ({ url, request, sameOrigin }) => request.destination === 'image' &&
    ((sameOrigin && url.pathname.startsWith('/assets/images/')) || url.origin === __PWA_CDN_ORIGIN__),
  new StaleWhileRevalidate({
    cacheName: imageCache,
    fetchOptions: { cache: 'reload' },
    plugins: [
      { cacheWillUpdate: async ({ response }) => response.status === 200 ? response : null },
      new ExpirationPlugin(imageExpiration),
    ],
  }),
)

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting())
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
