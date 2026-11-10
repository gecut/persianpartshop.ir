import { SMS_TEMPLATES, type SmsTemplateName } from './constants'
import type { SendPatternParams } from './types'

const KAVENEGAR_TIMEOUT_MS = 5_000

export function normalizeReceptor(phone: string): string {
  if (!phone) return ''
  const persianDigits = '۰۱۲۳۴۵۶۷۸۹'
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩'
  let normalized = phone.trim()
  for (let i = 0; i < 10; i++) {
    normalized = normalized.replaceAll(persianDigits[i]!, String(i)).replaceAll(arabicDigits[i]!, String(i))
  }
  const hasPlus = normalized.startsWith('+')
  const digitsOnly = normalized.replace(/\D/g, '')
  if (hasPlus || digitsOnly.startsWith('0098') || digitsOnly.startsWith('98')) {
    if (digitsOnly.startsWith('0098')) {
      return `0${digitsOnly.slice(4)}`
    }
    if (digitsOnly.startsWith('98')) {
      return `0${digitsOnly.slice(2)}`
    }
  }
  if (digitsOnly.length === 10 && digitsOnly.startsWith('9')) {
    return `0${digitsOnly}`
  }
  return digitsOnly
}

export function maskPhone(phone: string): string {
  if (!phone || phone.length < 8) return '***'
  return `${phone.slice(0, 4)}***${phone.slice(-4)}`
}

export function maskEndpoint(endpoint: string): string {
  return endpoint.replace(/\/v1\/[^/]+/, '/v1/***')
}

export function sanitizeToken(value: string | number | undefined | null): string {
  if (value === null || value === undefined) return ''
  const str = String(value).trim()
  const persianDigits = '۰۱۲۳۴۵۶۷۸۹'
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩'
  let normalized = str
  for (let i = 0; i < 10; i++) {
    normalized = normalized.replaceAll(persianDigits[i]!, String(i)).replaceAll(arabicDigits[i]!, String(i))
  }
  return normalized
    .replace(/^[\s\u200C]+|[\s\u200C]+$/g, '')
    .replace(/\s+/g, '\u200C')
}

export async function sendKavenegarPattern<T extends SmsTemplateName>(
  params: SendPatternParams<T>
): Promise<{ success: boolean; messageId?: number }> {
  const isDev = process.env.NODE_ENV !== 'production'
  const isDisabled = process.env.DISABLE_SMS === 'true'
  const apiKey = process.env.KAVENEGAR_API_KEY?.trim()

  const cleanReceptor = normalizeReceptor(params.receptor || '')

  // Development/Test mock behavior
  if (isDisabled || (!apiKey && isDev)) {
    if (params.template === SMS_TEMPLATES.OTP) {
      console.log(`[DEV OTP] Receptor: ${maskPhone(cleanReceptor)}, Code: ${(params.tokens as any).token}`)
    }
    return { success: true }
  }

  if (!apiKey) {
    throw new Error('کلید وب‌سرویس پیامک (KAVENEGAR_API_KEY) در سرور CMS تنظیم نشده است.')
  }

  const endpoint = `https://api.kavenegar.com/v1/${apiKey}/verify/lookup.json`

  const bodyParams = new URLSearchParams({
    receptor: cleanReceptor,
    template: params.template,
    token: sanitizeToken((params.tokens as any).token),
  })

  if ('token2' in params.tokens && (params.tokens as any).token2) {
    bodyParams.set('token2', sanitizeToken((params.tokens as any).token2))
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: bodyParams.toString(),
      signal: AbortSignal.timeout(KAVENEGAR_TIMEOUT_MS),
    })

    let data: any
    try {
      data = await res.json()
    } catch {
      data = null
    }

    if (!res.ok) {
      const msg = data?.return?.message || `خطای ارتباط با سرور کاوه‌نگار (وضعیت: ${res.status})`
      throw new Error(msg)
    }

    if (data?.return?.status !== 200) {
      throw new Error(data?.return?.message || `خطای اعتبارسنجی کاوه‌نگار (${data?.return?.status})`)
    }

    return {
      success: true,
      messageId: data.entries?.[0]?.messageid,
    }
  } catch (err: any) {
    console.error('[Kavenegar Gateway Error]', {
      endpoint: maskEndpoint(endpoint),
      receptor: maskPhone(cleanReceptor),
      template: params.template,
      error: err?.message || err,
    })
    throw err
  }
}
