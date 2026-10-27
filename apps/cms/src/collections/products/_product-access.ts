import type { Access, FieldAccess } from 'payload'
import { getAdminUser } from '../../access/roles'
import { getStockWriteMode } from './_inventory-math'

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
 * Update is restricted to operational staff and only permitted in maintenance modes.
 */
export const canUpdateOperationalInventory: FieldAccess = ({ req: { user }, req }) => {
  if (!isOperationalStaff(user)) return false
  const mode = getStockWriteMode()
  if (mode === 'normal') {
    // In normal mode, inventory cannot be overwritten directly by admin forms
    return false
  }
  return true
}

/**
 * Access rule for import/export collection operations:
 * Only operational staff (superadmin, manager, support) can trigger imports/exports.
 */
export const isImportExportAuthorized: Access = ({ req: { user } }) => {
  return isOperationalStaff(user)
}
