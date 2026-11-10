import { businessError } from '../../lib/validation'
import type { CollectionBeforeLoginHook } from 'payload'

export const isActiveBeforeLogin: CollectionBeforeLoginHook = async ({ user }) => {
  if (user && user.isActive === false) {
    throw businessError('حساب کاربری شما غیرفعال شده است. لطفاً با مدیر سیستم تماس بگیرید.', 'ADMIN_INACTIVE', 403)
  }
  return user
}
