/**
 * Kavenegar SMS Gateway Integration
 * Specialized for OTP Verification via Verify/Lookup Pattern Service
 * Documentation: https://kavenegar.com/rest.html
 */

export interface KavenegarLookupParams {
  receptor: string
  token: string
  token2?: string
  token3?: string
  token10?: string
  token20?: string
  template?: string
  type?: 'sms' | 'call'
}

export interface KavenegarResponse {
  return: {
    status: number
    message: string
  }
  entries?: Array<{
    messageid: number
    message: string
    status: number
    statustext: string
    sender: string
    receptor: string
    date: number
    cost: number
  }>
}

const DEFAULT_API_KEY =
  '46437751615871547A59364B75376339706E72384266734A596F3476644B653641356171462F557A5747383D'
const DEFAULT_TEMPLATE = 'gcotp'

export function getKavenegarConfig() {
  return {
    apiKey: process.env.KAVENEGAR_API_KEY || DEFAULT_API_KEY,
    defaultTemplate: process.env.KAVENEGAR_OTP_TEMPLATE || DEFAULT_TEMPLATE,
  }
}

/**
 * Sends an OTP verification SMS via Kavenegar Verify/Lookup API
 */
export async function sendKavenegarOtp(params: KavenegarLookupParams): Promise<KavenegarResponse> {
  const { apiKey, defaultTemplate } = getKavenegarConfig()
  const template = params.template || defaultTemplate

  if (!apiKey) {
    throw new Error('کلید وب‌سرویس کاوه‌نگار (KAVENEGAR_API_KEY) تنظیم نشده است.')
  }

  const endpoint = `https://api.kavenegar.com/v1/${apiKey}/verify/lookup.json`

  const bodyParams = new URLSearchParams({
    receptor: params.receptor,
    token: params.token,
    template,
  })

  if (params.token2) bodyParams.set('token2', params.token2)
  if (params.token3) bodyParams.set('token3', params.token3)
  if (params.token10) bodyParams.set('token10', params.token10)
  if (params.token20) bodyParams.set('token20', params.token20)
  if (params.type) bodyParams.set('type', params.type)

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: bodyParams.toString(),
    })

    if (!res.ok && res.status >= 500) {
      throw new Error(`خطای سرور کاوه‌نگار (کد وضعیت: ${res.status})`)
    }

    const data = (await res.json()) as KavenegarResponse

    if (data.return?.status !== 200) {
      const msg = data.return?.message || 'خطا در ارسال پیامک از طریق وب‌سرویس کاوه‌نگار'
      throw new Error(`${msg} (کد وضعیت کاوه‌نگار: ${data.return?.status})`)
    }

    return data
  } catch (error: any) {
    console.error('[Kavenegar Error]', {
      endpoint,
      receptor: params.receptor,
      template,
      error: error?.message || error,
    })
    throw error
  }
}
