import { ORPCError } from '@orpc/server'
import { sdk } from '../payload'
import { base, authed, adminOnly } from '../rpc/base'
import { fetchTaxonomy, getUserProfile } from './router.helpers'

const profile = authed.user.profile.handler(async ({ context }) => {
  const userDoc: any = await getUserProfile(context.user.id)
  if (!userDoc) return null
  const { notes, password, resetPasswordToken, salt, hash, ...safeUser } = userDoc
  if (safeUser.customerType && typeof safeUser.customerType === 'object') {
    const { markupPercent, ...safeCt } = safeUser.customerType
    safeUser.customerType = safeCt
  }
  return safeUser
})

const update = authed.user.update.handler(async ({ input, context }) => {
  // Whitelist safe update fields to prevent mass assignment of role, status, customerType, or creditLimit
  const allowedData: Record<string, any> = {}
  if (input.fullName !== undefined) allowedData.fullName = input.fullName
  if (input.companyName !== undefined) allowedData.companyName = input.companyName
  if (input.nationalCode !== undefined) allowedData.nationalCode = input.nationalCode
  if (input.economicCode !== undefined) allowedData.economicCode = input.economicCode
  if (input.province !== undefined) allowedData.province = input.province
  if (input.city !== undefined) allowedData.city = input.city
  if (input.address !== undefined) allowedData.address = input.address
  if (input.addresses !== undefined) allowedData.addresses = input.addresses
  if (input.documents !== undefined) {
    const currentDoc: any = await sdk.findByID({ collection: 'users', id: context.user.id })
    const existingApproved = Array.isArray(currentDoc?.documents)
      ? currentDoc.documents.filter((d: any) => d.status === 'approved')
      : []

    const incoming = Array.isArray(input.documents) ? input.documents : []

    // Customer CANNOT delete or change an approved document
    for (const approved of existingApproved) {
      const match = incoming.find((d: any) => String(d.id) === String(approved.id))
      if (!match) {
        throw new ORPCError('FORBIDDEN', {
          message: `مدرک تأیید شده «${approved.title || 'ثبت شده'}» قابل حذف نیست.`,
        })
      }
      const origFileId =
        typeof approved.file === 'object' && approved.file !== null ? approved.file.id : approved.file
      const newFileId =
        typeof match.file === 'object' && match.file !== null ? match.file.id : match.file
      if (String(origFileId) !== String(newFileId)) {
        throw new ORPCError('FORBIDDEN', {
          message: `فایل مدرک تأیید شده «${approved.title || 'ثبت شده'}» قابل تغییر یا جایگزینی نیست.`,
        })
      }
    }

    // Sanitize incoming docs: non-approved documents must have status 'pending' (customer cannot self-approve)
    allowedData.documents = incoming.map((doc: any) => {
      const isOriginallyApproved = existingApproved.some((a: any) => String(a.id) === String(doc.id))
      const fileId = typeof doc.file === 'object' && doc.file !== null ? doc.file.id : doc.file
      return {
        ...(doc.id ? { id: doc.id } : {}),
        documentType: doc.documentType || 'business_license',
        title: doc.title?.trim() || '',
        file: fileId,
        status: isOriginallyApproved ? 'approved' : 'pending',
        rejectionReason: isOriginallyApproved ? null : doc.rejectionReason || null,
        uploadedAt: doc.uploadedAt || new Date().toISOString(),
      }
    })
  }

  const updatedDoc: any = await sdk.update({
    collection: 'users',
    id: context.user.id,
    data: allowedData,
  })

  if (!updatedDoc) return null
  const { notes, password, resetPasswordToken, salt, hash, ...safeUser } = updatedDoc
  if (safeUser.customerType && typeof safeUser.customerType === 'object') {
    const { markupPercent, ...safeCt } = safeUser.customerType
    safeUser.customerType = safeCt
  }
  return safeUser
})

const list = adminOnly.user.list.handler(async ({ input }) => {
  const result = await sdk.find({
    collection: 'users',
    limit: input?.limit || 100,
    sort: '-createdAt',
  })
  return result.docs
})

const deleteUser = adminOnly.user.delete.handler(async ({ input }) => {
  return sdk.delete({ collection: 'users', id: input.id })
})

const customerTypes = base.user.customerTypes.handler(async ({ input }) => {
  const docs = await fetchTaxonomy('customer-types', { onlyActive: input?.onlyActive })
  return docs.map((doc: any) => {
    const { markupPercent, ...safeDoc } = doc
    return safeDoc
  })
})

export const user = base.user.router({
  profile,
  list,
  update,
  delete: deleteUser,
  customerTypes,
})
