import type { CollectionBeforeChangeHook } from 'payload'
import type { User } from '../../payload-types'
import { getAdminUser } from '../../access/roles'
import { fieldError, sameRelation } from '../../lib/validation'

export const validateUserChanges: CollectionBeforeChangeHook<User> = ({ data, originalDoc, req }) => {
  const status = data.status ?? (data.isBanned === true ? 'suspended' : originalDoc?.status)
  if (status === 'suspended') {
    data.status = 'suspended'
    data.isBanned = true
  } else if (status === 'active' || status === 'pending') {
    data.isBanned = false
    if (originalDoc?.status === 'suspended' && !data.banReason) data.banReason = null
  }
  const hidden = data.hideExactStock === undefined ? originalDoc?.hideExactStock : data.hideExactStock
  if (hidden) data.disableOrdering = true

  const actor = getAdminUser(req.user)
  const reviewer = !req.user || actor?.role === 'manager' || actor?.role === 'superadmin'
  if (data.documents !== undefined && !reviewer) {
    const incoming = data.documents ?? []
    for (const approved of originalDoc?.documents?.filter(doc => doc.status === 'approved') ?? []) {
      const matching = incoming.find(doc => doc.id === approved.id)
      if (!matching) fieldError('documents', 'مدرک تأییدشده قابل حذف نیست.')
      const changed = !sameRelation(matching.file, approved.file) ||
        (['title', 'documentType', 'status', 'uploadedAt', 'rejectionReason'] as const).some(key => (matching[key] ?? null) !== (approved[key] ?? null))
      if (changed) fieldError('documents', 'مدرک تأییدشده فقط توسط مدیر قابل اصلاح است.')
    }
    for (const doc of incoming) {
      if (!originalDoc?.documents?.some(old => old.id === doc.id && old.status === 'approved')) {
        doc.status = 'pending'
        doc.rejectionReason = null
      }
    }
  }
  for (const doc of data.documents ?? []) if (!doc.uploadedAt) doc.uploadedAt = new Date().toISOString()
  return data
}
