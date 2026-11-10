export const SMS_TEMPLATES = {
  OTP: 'otp',
  ORDER_REGISTERED: 'order-registered',
  ORDER_APPROVED: 'order-approved',
  ORDER_CANCELLED: 'order-cancelled',
  ADMIN_NEW_ORDER: 'admin-new-order',
  ADMIN_ORDER_CANCELLED: 'admin-order-cancelled',
  SUPPLY_RESULT: 'supply-result',
  ADMIN_NEW_SUPPLY_REQUEST: 'admin-new-supply-request',
  PLAN_ASSIGNED: 'plan-assigned',
} as const

export type SmsTemplateName = (typeof SMS_TEMPLATES)[keyof typeof SMS_TEMPLATES]
