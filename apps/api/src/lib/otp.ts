import crypto from 'node:crypto'
import { sdk } from '../payload'

export const OTP_EXPIRY_SECONDS = 120 // 2 minutes
export const OTP_COOLDOWN_SECONDS = 60 // 1 minute between requests
export const MAX_ATTEMPTS = 5

export interface OtpRecord {
  code: string | null
  expiresAt: string
  cooldownUntil: string
  attempts: number
  userId: number
}

/**
 * Normalizes phone numbers and digits (Persian/Arabic to English, strips whitespace)
 */
export function normalizeDigits(input: string): string {
  if (!input) return ''
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']
  let normalized = input.trim()
  for (let i = 0; i < 10; i++) {
    normalized = normalized.replaceAll(persianDigits[i], String(i)).replaceAll(arabicDigits[i], String(i))
  }
  return normalized.replace(/\s+/g, '')
}

/**
 * Generates a cryptographic 4-digit numeric code (1000 - 9999)
 */
export function generateRandomCode(): string {
  return String(crypto.randomInt(1000, 10000))
}

/**
 * Creates and stores a new OTP for the given phone number in PostgreSQL via Payload CMS
 */
export async function createOtp(
  phone: string,
  userId: number
): Promise<{ code: string; expiresInSeconds: number; cooldownSeconds: number }> {
  const normalizedPhone = normalizeDigits(phone)
  const now = Date.now()

  // 1. Check existing OTP record in CMS
  const existing = await sdk.find({
    collection: 'otps',
    where: { phone: { equals: normalizedPhone } },
    limit: 1,
    depth: 0,
  })

  if (existing.docs.length > 0) {
    const record = existing.docs[0] as any
    const cooldownTime = record.cooldownUntil ? new Date(record.cooldownUntil).getTime() : 0
    if (now < cooldownTime) {
      const remainingSeconds = Math.ceil((cooldownTime - now) / 1000)
      throw new Error(`لطفاً قبل از درخواست مجدد کد، ${remainingSeconds} ثانیه شکیبا باشید.`)
    }
  }

  const code = generateRandomCode()
  const expiresAt = new Date(now + OTP_EXPIRY_SECONDS * 1000).toISOString()
  const cooldownUntil = new Date(now + OTP_COOLDOWN_SECONDS * 1000).toISOString()

  if (existing.docs.length > 0) {
    await sdk.update({
      collection: 'otps',
      id: existing.docs[0].id,
      data: {
        code,
        expiresAt,
        cooldownUntil,
        attempts: 0,
        user: userId,
      },
    })
  } else {
    await sdk.create({
      collection: 'otps',
      data: {
        phone: normalizedPhone,
        user: userId,
        code,
        expiresAt,
        cooldownUntil,
        attempts: 0,
      },
    })
  }

  return {
    code,
    expiresInSeconds: OTP_EXPIRY_SECONDS,
    cooldownSeconds: OTP_COOLDOWN_SECONDS,
  }
}

/**
 * Verifies the provided OTP code for a given phone number against CMS PostgreSQL
 */
export async function verifyOtp(
  phone: string,
  inputCode: string
): Promise<{ success: boolean; error?: string }> {
  const normalizedPhone = normalizeDigits(phone)
  const normalizedCode = normalizeDigits(inputCode)
  const now = Date.now()

  const existing = await sdk.find({
    collection: 'otps',
    where: { phone: { equals: normalizedPhone } },
    limit: 1,
    depth: 0,
  })

  if (existing.docs.length === 0) {
    return {
      success: false,
      error: 'کد تایید برای این شماره صادر نشده یا منقضی شده است. لطفاً مجدداً درخواست دهید.',
    }
  }

  const record = existing.docs[0] as any
  const expiresAtMs = new Date(record.expiresAt).getTime()

  if (now > expiresAtMs || !record.code) {
    if (record.code) {
      await sdk.update({
        collection: 'otps',
        id: record.id,
        data: { code: null },
      })
    }
    return {
      success: false,
      error: 'کد تایید منقضی شده است. لطفاً کد جدید دریافت کنید.',
    }
  }

  if (Number(record.attempts) >= MAX_ATTEMPTS) {
    await sdk.update({
      collection: 'otps',
      id: record.id,
      data: { code: null },
    })
    return {
      success: false,
      error: 'تعداد دفعات ورود اشتباه بیش از حد مجاز بود. لطفاً کد جدید دریافت کنید.',
    }
  }

  if (record.code !== normalizedCode) {
    const nextAttempts = Number(record.attempts || 0) + 1
    await sdk.update({
      collection: 'otps',
      id: record.id,
      data: {
        attempts: nextAttempts,
        code: nextAttempts >= MAX_ATTEMPTS ? null : record.code,
      },
    })
    const remainingAttempts = MAX_ATTEMPTS - nextAttempts
    return {
      success: false,
      error: remainingAttempts > 0
        ? 'کد وارد شده اشتباه است.'
        : 'کد اشتباه است و باطل شد. لطفاً کد جدید دریافت کنید.',
    }
  }

  // Code matched successfully — consume by nulling the code
  await sdk.update({
    collection: 'otps',
    id: record.id,
    data: { code: null },
  })

  return { success: true }
}

/**
 * Invalidates the OTP code if SMS delivery fails
 */
export async function invalidateOtp(phone: string, code: string): Promise<void> {
  const normalizedPhone = normalizeDigits(phone)
  try {
    const existing = await sdk.find({
      collection: 'otps',
      where: {
        and: [
          { phone: { equals: normalizedPhone } },
          { code: { equals: code } },
        ],
      },
      limit: 1,
      depth: 0,
    })
    if (existing.docs.length > 0) {
      await sdk.update({
        collection: 'otps',
        id: existing.docs[0].id,
        data: { code: null },
      })
    }
  } catch {
    // Non-blocking best-effort
  }
}
