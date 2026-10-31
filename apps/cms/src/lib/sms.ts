export async function sendSmsNotification({
  receptor,
  message,
}: {
  receptor: string
  message: string
}) {
  const apiKey =
    process.env.KAVENEGAR_API_KEY ||
    '46437751615871547A59364B75376339706E72384266734A596F3476644B653641356171462F557A5747383D'

  if (!apiKey || !receptor) return

  const cleanReceptor = receptor
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .trim()

  const endpoint = `https://api.kavenegar.com/v1/${apiKey}/sms/send.json`

  try {
    const bodyParams = new URLSearchParams({
      receptor: cleanReceptor,
      message,
    })

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: bodyParams.toString(),
    })

    const data: any = await res.json().catch(() => null)
    console.log('[Kavenegar Plan SMS Result]', cleanReceptor, data?.return?.status, data?.return?.message)
  } catch (err) {
    console.error('[Kavenegar Plan SMS Error]', err)
  }
}
