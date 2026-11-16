import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve, basename } from 'node:path'
import { ORPCError } from '@orpc/server'
import { mediaUrl, offlineSnapshotImagePaths, projectOfflineHistory, selectCatalogPhotos, type CatalogMedia, type OfflineManifest, type OfflineSnapshot } from '@persianpart/contract'

const mediaDir = () => resolve(process.env.MEDIA_DIR || fileURLToPath(new URL('../../../cms/media', import.meta.url)))

const offlineOrigin = 'https://offline.invalid'

function mediaPath(value: CatalogMedia | null | undefined): string | undefined {
  const raw = mediaUrl(value, process.env.CDN_URL)
  if (!raw || raw === '/assets/images/placeholder.svg') return
  const url = new URL(raw, offlineOrigin)
  if (!/\.(?:jpe?g|png|webp|avif|gif)$/i.test(url.pathname)) return
  const cdn = process.env.CDN_URL ? new URL(process.env.CDN_URL).origin : undefined
  if (url.username || url.password || (url.origin !== cdn &&
    (url.origin !== offlineOrigin || !url.pathname.startsWith('/api/media/file/')))) {
    throw new ORPCError('SERVICE_UNAVAILABLE', { message: 'نسخهٔ قابل‌دریافت رسانه در دسترس نیست.' })
  }
  url.hash = ''
  return url.origin === offlineOrigin ? url.pathname + url.search : url.href
}

function mediaFile(path: string) {
  const name = decodeURIComponent(basename(new URL(path, offlineOrigin).pathname))
  if (!name || name !== basename(name) || name.includes('\\') || name === '..') throw new ORPCError('SERVICE_UNAVAILABLE')
  return resolve(mediaDir(), name)
}

export async function projectMedia(data: OfflineSnapshot): Promise<OfflineSnapshot> {
  const photos = Object.entries(data.products).map(([id, product]) => ({
    id, product, ...selectCatalogPhotos(product, mediaPath),
  }))
  const galleryPaths = new Map(photos.flatMap(({ gallery }) => gallery.map(photo => [mediaFile(photo.url), photo.url])))
  const mediaPaths: Record<string, string> = {}
  const candidates = new Map<string, { path: string; file: string }>()
  const note = (original: string, thumbnail?: string | null) => {
    const galleryUrl = galleryPaths.get(mediaFile(original))
    if (galleryUrl) {
      if (galleryUrl !== original) mediaPaths[original] = galleryUrl
      return galleryUrl
    }
    if (!thumbnail) return original
    try {
      const path = mediaPath(thumbnail)
      if (path && path !== original) candidates.set(original, { path, file: mediaFile(path) })
    } catch { /* An optional derivative can fall back to the original. */ }
    return original
  }

  for (const { cover } of photos) {
    if (!cover) continue
    const thumbnail = typeof cover.image === 'object' ? cover.image?.sizes?.galleryThumb?.url : undefined
    note(cover.url, thumbnail)
  }
  projectOfflineHistory(data, mediaPath, note)

  const available = new Map<string, boolean>()
  for (const [original, { path, file }] of candidates) {
    if (!available.has(file)) {
      const usable = await stat(file).then(entry => entry.isFile() && entry.size > 0, () => false)
      available.set(file, usable)
    }
    if (available.get(file)) mediaPaths[original] = path
  }

  const choose = (original: string) => mediaPaths[original] ?? original
  const products = Object.fromEntries(photos.map(({ id, product, cover, gallery }) => [
    id, {
      ...product,
      cover: cover ? choose(cover.url) : product.cover,
      gallery: gallery.map(photo => ({ image: photo.image })),
    },
  ]))
  return { ...data, products, ...projectOfflineHistory(data, mediaPath, choose), mediaPaths }
}

export async function mediaEntries(data: OfflineSnapshot) {
  const urls = offlineSnapshotImagePaths(data, mediaPath)
  const media: OfflineManifest['media'] = []
  for (const path of urls) {
    const bytes = await readFile(mediaFile(path)).catch(() => undefined)
    if (!bytes?.length) throw new ORPCError('SERVICE_UNAVAILABLE', { message: 'فایل یک تصویر بسته در دسترس نیست.' })
    media.push({ path, hash: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length })
  }
  return media
}
