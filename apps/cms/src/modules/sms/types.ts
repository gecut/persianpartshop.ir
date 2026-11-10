import type { SmsTemplateName } from './constants'

export interface TemplateTokenMap {
  'otp': { token: string }
  'order-registered': { token: string }
  'order-approved': { token: string }
  'order-cancelled': { token: string }
  'admin-new-order': { token: string; token2: string }
  'admin-order-cancelled': { token: string; token2: string }
  'supply-result': { token: string }
  'admin-new-supply-request': { token: string; token2: string }
  'plan-assigned': { token: string }
}

export type SendPatternParams<T extends SmsTemplateName> = {
  template: T
  receptor: string
  tokens: TemplateTokenMap[T]
}
