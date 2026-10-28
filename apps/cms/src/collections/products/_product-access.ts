import type { Access, FieldAccess } from 'payload'
import { getAdminUser } from '../../access/roles'

/**
 * Superadmin, Manager, and Support are authorized operational roles for product pricing/inventory and import/export.
 */
export const isOperationalStaff = (user: unknown): boolean => {
  const admin = getAdminUser(user)
  if (!admin || admin.isActive === false) return false
  return admin.role === 'superadmin' || admin.role === 'manager' || admin.role === 'support'
}

/**
 * Field-level access for basePricePerSqm:
 * Read is allowed for all authenticated admins (to view in admin UI).
 * Update/create is restricted to superadmin, manager, and support.
 */
export const canUpdateOperationalPrice: FieldAccess = ({ req: { user } }) => {
  return isOperationalStaff(user)
}

/**
 * Field-level access for inventorySqm:
 * Update/create is restricted to operational staff. Inventory is an absolute
 * authoritative value, so no maintenance window gates direct edits.
 */
export const canUpdateOperationalInventory: FieldAccess = ({ req: { user } }) => {
  return isOperationalStaff(user)
}

/**
 * Access rule for import/export collection operations:
 * Only operational staff (superadmin, manager, support) can trigger imports/exports.
 */
export const isImportExportAuthorized: Access = ({ req: { user } }) => {
  return isOperationalStaff(user)
}
