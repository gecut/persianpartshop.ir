import { base } from '../rpc/base'
import { ORPCError } from '@orpc/server'
import { generateToken } from '../lib/jwt'
import { sendKavenegarOtp } from '../lib/kavenegar'
import { createOtp, verifyOtp as verifyStoredOtp, invalidateOtp, normalizeDigits } from '../lib/otp'
import {
  toPersianDigits,
  findUserByPhone,
  getUserProfile,
  formatCustomerProfile,
  handleLogout,
} from './router.helpers'

/**
 * Shared OTP request logic using Kavenegar pattern lookup service
 */
async function processRequestOtp(rawPhone: string) {
  const phone = normalizeDigits(rawPhone)
  if (!phone || !/^09\d{9}$/.test(phone)) {
    throw new ORPCError('BAD_REQUEST', {
      message: 'لطفاً شماره تلفن همراه معتبر ۱۱ رقمی (مانند ۰۹۱۲۳۴۵۶۷۸۹) وارد نمایید.',
    })
  }

  // Customers must be pre-registered by admin in Payload panel
  const userDoc = await findUserByPhone(phone)
  if (!userDoc) {
    throw new ORPCError('FORBIDDEN', {
      message:
        'شماره همراه شما در سامانه ثبت نشده است. افتتاح حساب کاربری مشتریان منحصراً توسط مدیریت پرشین پارت انجام می‌شود. لطفاً با پشتیبانی تماس بگیرید.',
    })
  }

  if (userDoc.isBanned || userDoc.status === 'suspended') {
    const reason = userDoc.banReason ? ` به علت: «${userDoc.banReason}»` : ''
    throw new ORPCError('FORBIDDEN', {
      message: `حساب کاربری شما توسط مدیریت مسدود شده است.${reason} جهت رفع مسدودی یا اطلاعات بیشتر لطفاً با پشتیبانی تماس بگیرید.`,
    })
  }

  if (userDoc.status === 'pending') {
    throw new ORPCError('FORBIDDEN', {
      message: 'حساب کاربری شما در انتظار تایید مدارک توسط مدیریت است.',
    })
  }

  if (userDoc.status !== 'active') {
    throw new ORPCError('FORBIDDEN', {
      message: 'حساب کاربری شما فعال نیست. لطفاً با پشتیبانی تماس بگیرید.',
    })
  }

  let otpData: { code: string; expiresInSeconds: number; cooldownSeconds: number }
  try {
    otpData = await createOtp(phone, userDoc.id)
  } catch (err: any) {
    throw new ORPCError('BAD_REQUEST', {
      message: err.message || 'لطفاً کمی صبر کنید و دوباره تلاش نمایید.',
    })
  }

  // Print OTP clearly in terminal/logs for demo and testing
  console.log(`\n======================================================`)
  console.log(`🔑 [DEMO OTP] شماره: ${phone} | کد تایید یکبار مصرف: ${otpData.code}`)
  console.log(`======================================================\n`)

  try {
    await sendKavenegarOtp({
      receptor: phone,
      token: otpData.code,
      template: 'gcotp',
    })
  } catch (smsErr) {
    console.warn(`[SMS Warning] ارسال پیامک کاوه‌نگار انجام نشد اما کد ${otpData.code} جهت ورود فعال است.`)
  }

  return {
    success: true,
    cooldownSeconds: otpData.cooldownSeconds,
    expiresInSeconds: otpData.expiresInSeconds,
    message: `کد تایید ارسال گردید. (کد ورود دمو: ${otpData.code})`,
  }
}

/**
 * Shared OTP verification logic
 */
async function processVerifyOtp(rawPhone: string, rawCode: string) {
  const phone = normalizeDigits(rawPhone)
  const code = normalizeDigits(rawCode)

  if (!phone) {
    throw new ORPCError('BAD_REQUEST', { message: 'شماره تلفن همراه الزامی است.' })
  }

  if (!code) {
    throw new ORPCError('BAD_REQUEST', { message: 'کد تایید یکبار مصرف الزامی است.' })
  }

  const userDoc = await findUserByPhone(phone)
  if (!userDoc) {
    throw new ORPCError('FORBIDDEN', {
      message:
        'شماره همراه شما در سامانه ثبت نشده است. حساب کاربری مشتریان منحصراً توسط مدیریت پرشین پارت تعریف می‌گردد.',
    })
  }

  if (userDoc.isBanned || userDoc.status === 'suspended') {
    const reason = userDoc.banReason ? ` به علت: «${userDoc.banReason}»` : ''
    throw new ORPCError('FORBIDDEN', {
      message: `حساب کاربری شما توسط مدیریت مسدود شده است.${reason} جهت رفع مسدودی یا اطلاعات بیشتر لطفاً با پشتیبانی تماس بگیرید.`,
    })
  }

  if (userDoc.status !== 'active') {
    throw new ORPCError('FORBIDDEN', {
      message: 'حساب کاربری شما غیرفعال است. لطفاً با پشتیبانی تماس بگیرید.',
    })
  }

  const verification = await verifyStoredOtp(phone, code)
  if (!verification.success) {
    throw new ORPCError('BAD_REQUEST', {
      message: verification.error || 'کد وارد شده اشتباه یا منقضی است.',
    })
  }

  const token = await generateToken({
    id: userDoc.id,
    phone: userDoc.phone,
    fullName: userDoc.fullName || undefined,
    role: 'customer',
  })

  const { notes, ...safeUser } = (userDoc || {}) as any

  return {
    token,
    user: safeUser,
    customer: formatCustomerProfile(userDoc),
  }
}

const handleRequestOtp = async ({ input }: { input: { phone?: string; mobile?: string } }) => {
  return processRequestOtp(input.phone || input.mobile || '')
}

const handleVerifyOtp = async ({
  input,
}: {
  input: { phone?: string; mobile?: string; code?: string }
}) => {
  return processVerifyOtp(input.phone || input.mobile || '', input.code || '')
}

export const auth = base.auth.router({
  requestOtp: base.auth.requestOtp.handler(handleRequestOtp),
  verifyOtp: base.auth.verifyOtp.handler(handleVerifyOtp),
  session: base.auth.session.handler(async ({ context }) => {
    if (context.isBanned) {
      const reason = context.banReason ? ` به علت: «${context.banReason}»` : ''
      throw new ORPCError('FORBIDDEN', {
        message: `حساب کاربری شما توسط مدیریت مسدود شده است.${reason}`,
      })
    }
    if (!context.user) return { user: null }
    try {
      const userDoc: any = await getUserProfile(context.user.id)
      if (!userDoc || userDoc.status === 'suspended' || userDoc.isBanned) {
        const reason = userDoc?.banReason ? ` به علت: «${userDoc.banReason}»` : ''
        throw new ORPCError('FORBIDDEN', {
          message: `حساب کاربری شما توسط مدیریت مسدود شده است.${reason}`,
        })
      }
      const { notes, ...safeUser } = userDoc
      return { user: safeUser }
    } catch (err) {
      if (err instanceof ORPCError) throw err
      return { user: null }
    }
  }),
  logout: base.auth.logout.handler(async ({ context }) => handleLogout(context)),
  customer: {
    requestOtp: base.auth.customer.requestOtp.handler(handleRequestOtp),
    verifyOtp: base.auth.customer.verifyOtp.handler(handleVerifyOtp),
    me: base.auth.customer.me.handler(async ({ context }) => {
      if (context.isBanned) {
        const reason = context.banReason ? ` به علت: «${context.banReason}»` : ''
        throw new ORPCError('FORBIDDEN', {
          message: `حساب کاربری شما توسط مدیریت مسدود شده است.${reason}`,
        })
      }
      if (!context.user) return null
      try {
        const userDoc: any = await getUserProfile(context.user.id)
        if (!userDoc || userDoc.status === 'suspended' || userDoc.isBanned) {
          const reason = userDoc?.banReason ? ` به علت: «${userDoc.banReason}»` : ''
          throw new ORPCError('FORBIDDEN', {
            message: `حساب کاربری شما توسط مدیریت مسدود شده است.${reason}`,
          })
        }
        return formatCustomerProfile(userDoc)
      } catch (err) {
        if (err instanceof ORPCError) throw err
        return null
      }
    }),
  },
})
