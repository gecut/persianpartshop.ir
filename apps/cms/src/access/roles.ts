import type { Access, FieldAccess } from 'payload'

export type AdminRole = 'superadmin' | 'manager' | 'editor' | 'support' | 'service'

const VALID_ROLES = new Set<string>(['superadmin', 'manager', 'editor', 'support', 'service'])

export interface AdminUser {
  id: string | number
  email?: string
  role: AdminRole
  isActive: boolean
  collection: 'admins'
  _strategy?: string
}

export const getAdminUser = (reqUser: unknown): AdminUser | null => {
  if (!reqUser || typeof reqUser !== 'object') return null
  const u = reqUser as Record<string, unknown>
  // Enforce collection === 'admins', valid known role, and not deactivated
  if (u.collection === 'admins' && typeof u.role === 'string' && VALID_ROLES.has(u.role)) {
    if (u.isActive === false) return null
    return u as unknown as AdminUser
  }
  return null
}

export const isAdminAuthenticated: Access = ({ req: { user } }) => {
  const admin = getAdminUser(user)
  return Boolean(admin)
}

export const isSuperAdmin: Access = ({ req: { user } }) => {
  const admin = getAdminUser(user)
  return Boolean(admin && admin.role === 'superadmin')
}

export const isCatalogManager: Access = ({ req: { user } }) => {
  const admin = getAdminUser(user)
  if (!admin) return false
  return (
    admin.role === 'superadmin' ||
    admin.role === 'manager' ||
    admin.role === 'editor' ||
    admin.role === 'service'
  )
}

export const isCatalogEditor: Access = ({ req: { user } }) => {
  const admin = getAdminUser(user)
  if (!admin) return false
  return (
    admin.role === 'superadmin' ||
    admin.role === 'manager' ||
    admin.role === 'editor'
  )
}

export const isSalesManager: Access = ({ req: { user } }) => {
  const admin = getAdminUser(user)
  if (!admin) return false
  return (
    admin.role === 'superadmin' ||
    admin.role === 'manager' ||
    admin.role === 'support' ||
    admin.role === 'service'
  )
}

export const canManageUsers: Access = ({ req: { user } }) => {
  const admin = getAdminUser(user)
  if (!admin) return false
  return admin.role === 'superadmin' || admin.role === 'manager'
}

export const canManagePlans: Access = ({ req: { user } }) => {
  const admin = getAdminUser(user)
  if (!admin) return false
  return admin.role === 'superadmin' || admin.role === 'manager'
}

export const canCreateOrder: Access = ({ req: { user } }) => {
  const admin = getAdminUser(user)
  if (!admin) return false
  return admin.role === 'superadmin' || admin.role === 'manager' || admin.role === 'service'
}

export const canUpdateOrder: Access = ({ req: { user } }) => {
  const admin = getAdminUser(user)
  if (!admin) return false
  return (
    admin.role === 'superadmin' ||
    admin.role === 'manager' ||
    admin.role === 'support' ||
    admin.role === 'service'
  )
}

export const isSelfAdminOrSuperAdmin: Access = ({ req: { user } }) => {
  const admin = getAdminUser(user)
  if (!admin) return false
  if (admin.role === 'superadmin') return true
  return {
    id: {
      equals: admin.id,
    },
  }
}

export const isSuperAdminField: FieldAccess = ({ req: { user } }) => {
  const admin = getAdminUser(user)
  return Boolean(admin && admin.role === 'superadmin')
}

export const canManageUsersField: FieldAccess = ({ req: { user } }) => {
  const admin = getAdminUser(user)
  return Boolean(admin && (admin.role === 'superadmin' || admin.role === 'manager'))
}
