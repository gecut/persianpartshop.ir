import { sdk } from '../lib/payload'

const localBase = 'https://offline.invalid/api/media/file/'

function mediaFilename(raw: string | null | undefined) {
  if (!raw) return
  try {
    const url = new URL(raw, localBase)
    const cdn = process.env.CDN_URL && new URL(process.env.CDN_URL.replace(/\/+$/, '') + '/')
    const base = cdn && url.origin === cdn.origin ? cdn : new URL(localBase)
    if (url.username || url.password || url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return
    const filename = decodeURIComponent(url.pathname.slice(base.pathname.length))
    if (!/[/\\]/.test(filename) && /\.(webp|jpe?g|png|avif|gif)$/i.test(filename)) return filename
  } catch { /* Older records can contain a non-media reference. */ }
}

export async function historyThumbnails(urls: Array<string | null | undefined>) {
  const filenames = new Map<string, string>()
  for (const url of urls) {
    const filename = mediaFilename(url)
    if (url && filename) filenames.set(url, filename)
  }

  const thumbnails = new Map<string, string>()
  const names = [...new Set(filenames.values())]
  const byFilename = new Map<string, string>()
  for (let i = 0; i < names.length; i += 100) {
    const result = await sdk.find({
      collection: 'media', where: { filename: { in: names.slice(i, i + 100) } }, depth: 0, pagination: false,
    }).catch(() => undefined)
    for (const doc of result?.docs ?? []) {
      const thumbnail = doc.sizes?.galleryThumb?.url
      if (doc.filename && thumbnail) byFilename.set(doc.filename, thumbnail)
    }
  }
  for (const [url, filename] of filenames) {
    const thumbnail = byFilename.get(filename)
    if (thumbnail) thumbnails.set(url, thumbnail)
  }
  return thumbnails
}
