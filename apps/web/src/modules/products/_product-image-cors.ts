const cdn = new URL(import.meta.env.VITE_CDN_URL || 'https://cdn.persianpart.shop').origin

export function productImageCors(src: string): 'anonymous' | undefined {
  if (cdn === window.location.origin) return
  try {
    if (new URL(src, window.location.href).origin === cdn) return 'anonymous'
  } catch { /* Let the image element handle an invalid URL. */ }
}

export function retryWithoutImageCors(image: HTMLImageElement) {
  if (!image.hasAttribute('crossorigin')) return false
  // Keep images usable if the deployment's CDN does not expose CORS headers.
  image.removeAttribute('crossorigin')
  return true
}
