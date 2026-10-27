import type { CollectionBeforeLoginHook } from 'payload'

export const isActiveBeforeLogin: CollectionBeforeLoginHook = async ({ user }) => {
  if (user && user.isActive === false) {
    throw new Error('حساب کاربری شما غیرفعال شده است. لطفاً با مدیر سیستم تماس بگیرید.')
  }
  return user
}
