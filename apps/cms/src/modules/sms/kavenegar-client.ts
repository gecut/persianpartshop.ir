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

export interface SanitizeTokenOptions {
  allowSpaces?: boolean
  maxSpaces?: number
}

export function sanitizeToken(
  value: string | number | undefined | null,
  options: SanitizeTokenOptions = {}
): string {
  if (value === null || value === undefined) return ''
  const str = String(value).trim()
  const persianDigits = '۰۱۲۳۴۵۶۷۸۹'
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩'
  let normalized = str
  for (let i = 0; i < 10; i++) {
    normalized = normalized.replaceAll(persianDigits[i]!, String(i)).replaceAll(arabicDigits[i]!, String(i))
  }
  // Strip control characters, newlines, carriage returns, tabs, and zero-width characters (e.g. ZWNJ which triggers 431)
  normalized = normalized.replace(/[\r\n\t\f\v\u200B-\u200D\uFEFF]+/g, ' ')

  if (options.allowSpaces) {
    normalized = normalized.replace(/\s+/g, ' ').trim()
    if (options.maxSpaces !== undefined) {
      const parts = normalized.split(' ')
      if (parts.length > options.maxSpaces + 1) {
        normalized = parts.slice(0, options.maxSpaces + 1).join(' ')
      }
    }
    return normalized
  }

  // When spaces are forbidden (standard token/token2/token3), remove them completely without separators
  return normalized.replace(/\s+/g, '')
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

  const tokensObj = params.tokens as any
  const bodyParams = new URLSearchParams({
    receptor: cleanReceptor,
    template: params.template,
    token: sanitizeToken(tokensObj.token, {
      allowSpaces: params.template === SMS_TEMPLATES.PLAN_ASSIGNED,
      maxSpaces: 5,
    }),
  })

  // Support token10 (Kavenegar standard for names with up to 5 spaces)
  if ('token10' in tokensObj && tokensObj.token10) {
    bodyParams.set('token10', sanitizeToken(tokensObj.token10, { allowSpaces: true, maxSpaces: 5 }))
  }

  // Support token20 (longer texts with up to 8 spaces)
  if ('token20' in tokensObj && tokensObj.token20) {
    bodyParams.set('token20', sanitizeToken(tokensObj.token20, { allowSpaces: true, maxSpaces: 8 }))
  }

  // Backward-compatibility: if token2 is provided and token10 is not set
  if ('token2' in tokensObj && tokensObj.token2 && !bodyParams.has('token10')) {
    bodyParams.set('token2', sanitizeToken(tokensObj.token2, { allowSpaces: false }))
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
