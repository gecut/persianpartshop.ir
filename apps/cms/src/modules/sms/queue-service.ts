import type { Payload, PayloadRequest } from 'payload'
import type { SmsTemplateName } from './constants'
import type { TemplateTokenMap } from './types'
import { normalizeReceptor } from './kavenegar-client'

export async function enqueueSms<T extends SmsTemplateName>(
  payload: Payload,
  params: {
    receptor: string
    template: T
    tokens: TemplateTokenMap[T]
    req?: PayloadRequest
  }
): Promise<void> {
  const cleanReceptor = normalizeReceptor(params.receptor || '')
  if (!cleanReceptor) {
    return
  }

  await payload.create({
    collection: 'sms-queue',
    data: {
      receptor: cleanReceptor,
      template: params.template,
      tokens: params.tokens,
      status: 'pending',
      attempts: 0,
    },
    req: params.req,
    overrideAccess: true,
  })
}
