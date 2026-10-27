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
