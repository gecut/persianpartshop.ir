import type { FieldAccess } from 'payload'
import { getAdminUser } from '../../access/roles'

/**
 * Superadmin and manager are authorized for operational prices and import/export.
 * Warehouse balances use their separate controlled access and update paths.
 */
export const isOperationalStaff = (user: unknown): boolean => {
  const admin = getAdminUser(user)
  if (!admin || admin.isActive === false) return false
  return admin.role === 'superadmin' || admin.role === 'manager'
}

/**
 * Field-level access for basePricePerSqm:
 * Read is allowed for all authenticated admins (to view in admin UI).
 * Update/create is restricted to superadmin and manager.
 */
export const canUpdateOperationalPrice: FieldAccess = ({ req: { user } }) => {
  return isOperationalStaff(user)
}
