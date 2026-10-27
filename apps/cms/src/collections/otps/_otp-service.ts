import crypto from 'node:crypto'
import type { PayloadRequest } from 'payload'
import { getOrderTransaction } from '../orders/_transaction'

export const OTP_EXPIRY_SECONDS = 120 // 2 minutes
export const OTP_COOLDOWN_SECONDS = 60 // 1 minute between requests
export const MAX_ATTEMPTS = 5

export function generateCryptoOtp(): string {
  // Generates cryptographic 4-digit code (1000 - 9999)
  return String(crypto.randomInt(1000, 10000))
}

export interface IssueOtpResult {
  code: string
  expiresInSeconds: number
  cooldownSeconds: number
}

export interface VerifyOtpResult {
  success: boolean
  error?: string
}

/**
 * Issues a new OTP for a user:
 * - Checks cooldown on existing record
 * - Generates secure 4-digit code
 * - Updates or creates the OTP record with fresh expiry and zero attempts
 */
export async function issueOtpCommand(
  req: PayloadRequest,
  params: { phone: string; userId: number }
): Promise<IssueOtpResult> {
  const { phone, userId } = params
  const now = new Date()
  const nowMs = now.getTime()

  // 1. Look up existing OTP record for this user/phone
  const existing = await req.payload.find({
    collection: 'otps',
    where: { phone: { equals: phone } },
    limit: 1,
    depth: 0,
    req,
  })

  if (existing.docs.length > 0) {
    const record = existing.docs[0] as any
    const cooldownDate = record.cooldownUntil ? new Date(record.cooldownUntil).getTime() : 0
    if (nowMs < cooldownDate) {
      const remainingSeconds = Math.ceil((cooldownDate - nowMs) / 1000)
      throw new Error(`لطفاً قبل از درخواست مجدد کد، ${remainingSeconds} ثانیه شکیبا باشید.`)
    }
  }

  const code = generateCryptoOtp()
  const expiresAt = new Date(nowMs + OTP_EXPIRY_SECONDS * 1000).toISOString()
  const cooldownUntil = new Date(nowMs + OTP_COOLDOWN_SECONDS * 1000).toISOString()

  if (existing.docs.length > 0) {
    await req.payload.update({
      collection: 'otps',
      id: existing.docs[0].id,
      data: {
        code,
        expiresAt,
        cooldownUntil,
        attempts: 0,
        user: userId,
      },
      req,
    })
  } else {
    await req.payload.create({
      collection: 'otps',
      data: {
        phone,
        user: userId,
        code,
        expiresAt,
        cooldownUntil,
        attempts: 0,
      },
      req,
    })
  }

  return {
    code,
    expiresInSeconds: OTP_EXPIRY_SECONDS,
    cooldownSeconds: OTP_COOLDOWN_SECONDS,
  }
}

/**
 * Verifies the OTP:
 * - Checks expiry and maximum attempts
 * - If code matches: nulls the code (consumed) and returns success
 * - If code mismatches: increments attempts (nulls code if >= 5 attempts reached)
 */
export async function verifyOtpCommand(
  req: PayloadRequest,
  params: { phone: string; code: string }
): Promise<VerifyOtpResult> {
  const { phone, code } = params
  const nowMs = Date.now()

  const existing = await req.payload.find({
    collection: 'otps',
    where: { phone: { equals: phone } },
    limit: 1,
    depth: 0,
    req,
  })

  if (existing.docs.length === 0) {
    return {
      success: false,
      error: 'کد تایید برای این شماره صادر نشده یا منقضی شده است. لطفاً مجدداً درخواست دهید.',
    }
  }

  const record = existing.docs[0] as any
  const expiresAtMs = new Date(record.expiresAt).getTime()

  if (nowMs > expiresAtMs || !record.code) {
    // Null out expired code
    if (record.code) {
      await req.payload.update({
        collection: 'otps',
        id: record.id,
        data: { code: null },
        req,
      })
    }
    return {
      success: false,
      error: 'کد تایید منقضی شده است. لطفاً کد جدید دریافت کنید.',
    }
  }

  if (Number(record.attempts) >= MAX_ATTEMPTS) {
    await req.payload.update({
      collection: 'otps',
      id: record.id,
      data: { code: null },
      req,
    })
    return {
      success: false,
      error: 'تعداد دفعات ورود اشتباه بیش از حد مجاز بود. لطفاً کد جدید دریافت کنید.',
    }
  }

  if (record.code !== code) {
    const nextAttempts = Number(record.attempts || 0) + 1
    await req.payload.update({
      collection: 'otps',
      id: record.id,
      data: {
        attempts: nextAttempts,
        code: nextAttempts >= MAX_ATTEMPTS ? null : record.code,
      },
      req,
    })
    const remaining = MAX_ATTEMPTS - nextAttempts
    return {
      success: false,
      error: remaining > 0
        ? 'کد وارد شده اشتباه است.'
        : 'کد اشتباه است و باطل شد. لطفاً کد جدید دریافت کنید.',
    }
  }

  // Code matched successfully — consume by nulling the code
  await req.payload.update({
    collection: 'otps',
    id: record.id,
    data: {
      code: null,
    },
    req,
  })

  return { success: true }
}

/**
 * Invalidates active OTP if SMS delivery definitively fails
 */
export async function invalidateOtpCommand(
  req: PayloadRequest,
  params: { phone: string; code: string }
): Promise<void> {
  const { phone, code } = params
  const existing = await req.payload.find({
    collection: 'otps',
    where: {
      and: [
        { phone: { equals: phone } },
        { code: { equals: code } },
      ],
    },
    limit: 1,
    depth: 0,
    req,
  })

  if (existing.docs.length > 0) {
    await req.payload.update({
      collection: 'otps',
      id: existing.docs[0].id,
      data: { code: null },
      req,
    })
  }
}
