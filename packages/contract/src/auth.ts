import { oc } from '@orpc/contract'
import { openapi } from '@orpc/openapi'
import { z } from 'zod'
import {
  IranianMobileSchema,
  StandardErrorDataSchema,
} from './common'
import { CustomerProfileSchema } from './customer'

export const RequestOtpInputSchema = z.object({
  mobile: IranianMobileSchema.optional(),
  phone: z.string().optional(),
})

export type RequestOtpInput = z.infer<typeof RequestOtpInputSchema>

export const RequestOtpOutputSchema = z.object({
  success: z.boolean(),
  cooldownSeconds: z.number().int().positive().optional(),
  expiresInSeconds: z.number().int().positive().optional(),
  message: z.string().optional(),
})

export type RequestOtpOutput = z.infer<typeof RequestOtpOutputSchema>

export const VerifyOtpInputSchema = z.object({
  mobile: IranianMobileSchema.optional(),
  phone: z.string().optional(),
  code: z
    .string()
    .trim()
    .min(4, 'کد تایید حداقل ۴ رقم است')
    .max(6, 'کد تایید حداکثر ۶ رقم است'),
})

export type VerifyOtpInput = z.infer<typeof VerifyOtpInputSchema>

export const CustomerAuthResponseSchema = z.object({
  token: z.string(),
  customer: CustomerProfileSchema.optional(),
  user: z.any().optional(),
})

export type CustomerAuthResponse = z.infer<typeof CustomerAuthResponseSchema>

export const authContract = {
  requestOtp: oc
    .meta(openapi({ method: 'POST', path: '/auth/request-otp', summary: 'درخواست کد یکبار مصرف پیامکی' }))
    .input(RequestOtpInputSchema)
    .output(RequestOtpOutputSchema)
    .errors({
      FORBIDDEN: { data: StandardErrorDataSchema },
      BAD_REQUEST: { data: StandardErrorDataSchema },
      NOT_FOUND: { data: StandardErrorDataSchema },
    }),

  verifyOtp: oc
    .meta(openapi({ method: 'POST', path: '/auth/verify-otp', summary: 'بررسی کد یکبار مصرف و ورود' }))
    .input(VerifyOtpInputSchema)
    .output(CustomerAuthResponseSchema.or(z.any()))
    .errors({
      FORBIDDEN: { data: StandardErrorDataSchema },
      BAD_REQUEST: { data: StandardErrorDataSchema },
      NOT_FOUND: { data: StandardErrorDataSchema },
      UNAUTHORIZED: { data: StandardErrorDataSchema },
    }),

  session: oc
    .meta(openapi({ method: 'GET', path: '/auth/session', summary: 'وضعیت نشست کاربر جاری' }))
    .output(
      z.object({
        user: z.any().nullable(),
      })
    ),

  logout: oc
    .meta(openapi({ method: 'POST', path: '/auth/logout', summary: 'خروج از حساب کاربری' }))
    .output(
      z.object({
        success: z.boolean(),
      })
    ),

  customer: {
    requestOtp: oc
      .meta(openapi({ method: 'POST', path: '/auth/customer/request-otp', summary: 'درخواست کد یکبار مصرف پیامکی مشتری' }))
      .input(RequestOtpInputSchema)
      .output(RequestOtpOutputSchema)
      .errors({
        ACCOUNT_INACTIVE: {},
        NOT_FOUND: {},
        TOO_MANY_ATTEMPTS: {},
        FORBIDDEN: {},
        BAD_REQUEST: {},
      }),

    verifyOtp: oc
      .meta(openapi({ method: 'POST', path: '/auth/customer/verify-otp', summary: 'بررسی کد یکبار مصرف و ورود مشتری' }))
      .input(VerifyOtpInputSchema)
      .output(CustomerAuthResponseSchema.or(z.any()))
      .errors({
        OTP_INVALID: {},
        OTP_EXPIRED: {},
        ACCOUNT_INACTIVE: {},
        TOO_MANY_ATTEMPTS: {},
        FORBIDDEN: {},
        BAD_REQUEST: {},
        NOT_FOUND: {},
        UNAUTHORIZED: {},
      }),

    me: oc
      .meta(openapi({ method: 'GET', path: '/auth/customer/me', summary: 'بررسی وضعیت نشست جاری مشتری' }))
      .output(CustomerProfileSchema.or(z.any()).nullable())
      .errors({
        UNAUTHORIZED: {},
      }),
  },
}
