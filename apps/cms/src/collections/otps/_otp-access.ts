import type { Access } from 'payload'
import { getAdminUser } from '../../access/roles'

export const isServiceAdmin: Access = ({ req: { user } }) => {
  const admin = getAdminUser(user)
  return Boolean(admin && admin.role === 'service')
}
