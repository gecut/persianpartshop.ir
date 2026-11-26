import type { Access, PayloadRequest } from 'payload'
import { getAdminUser } from '../../access/roles'

export const canManageQr = (req: PayloadRequest): boolean => {
  const user = getAdminUser(req.user)
  return Boolean(user && user.isActive !== false && (user.role === 'manager' || user.role === 'superadmin'))
}
export const isQrManager: Access = ({ req }) => canManageQr(req)
