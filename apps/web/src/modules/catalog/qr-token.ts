const TOKEN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/
const URL_PATH = /\/q\/([^/?#\s]+)\/?(?:[?#].*)?$/i

export function parseQrToken(raw: string): string | null {
  const text = raw.trim()
  if (!text) return null
  const fromPath = URL_PATH.exec(text)?.[1]
  const token = (fromPath ?? text).toUpperCase()
  return TOKEN.test(token) ? token : null
}
