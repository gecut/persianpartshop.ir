const SMS_TIMEOUT_MS = 5_000

export async function sendSmsNotification({
  receptor,
  message,
}: {
  receptor: string
  message: string
}) {
  if (process.env.DISABLE_SMS === 'true') {
    return
  }

  const apiKey = process.env.KAVENEGAR_API_KEY?.trim()

  if (!apiKey) {
    console.error('[SMS] Provider is not configured')
    return
  }
  if (!receptor) return

  const cleanReceptor = receptor
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .trim()

  const endpoint = `https://api.kavenegar.com/v1/${apiKey}/sms/send.json`

  const controller = new AbortController()
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    const bodyParams = new URLSearchParams({
      receptor: cleanReceptor,
      message,
    })

    await Promise.race([
      (async () => {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
          body: bodyParams.toString(),
          signal: controller.signal,
        })
        if (!res.ok) throw new Error('Provider request failed')
        const response: unknown = await res.json().catch(() => null)
        if (typeof response !== 'object' || response === null || !('return' in response) ||
          typeof response.return !== 'object' || response.return === null || !('status' in response.return) ||
          response.return.status !== 200) throw new Error('Provider request failed')
      })(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => { controller.abort(); reject(new Error('Provider timeout')) }, SMS_TIMEOUT_MS)
      }),
    ])
  } catch {
    console.error('[SMS] Provider request failed')
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}
