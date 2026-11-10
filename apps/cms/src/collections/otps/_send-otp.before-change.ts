import type { CollectionBeforeChangeHook } from 'payload'
import { SMS_TEMPLATES } from '../../modules/sms/constants'
import { sendKavenegarPattern } from '../../modules/sms/kavenegar-client'

export const sendOtpBeforeChange: CollectionBeforeChangeHook = async ({ data, originalDoc, context }) => {
  if (context?.skipSms) return data

  if (data?.code && data.code !== originalDoc?.code) {
    const receptor = data.phone || originalDoc?.phone
    if (!receptor) {
      throw new Error('شماره همراه جهت ارسال کد تایید الزامی است.')
    }
    await sendKavenegarPattern({
      template: SMS_TEMPLATES.OTP,
      receptor,
      tokens: { token: data.code },
    })
  }
  return data
}
