const sevenDays = 7 * 24 * 60 * 60 * 1000

export function offlineAccessUntil(tokenExpirySeconds: number | undefined, now = Date.now()) {
  if (!tokenExpirySeconds) return undefined
  return Math.min(tokenExpirySeconds * 1000, now + sevenDays)
}
