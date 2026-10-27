import { sdk } from '../payload'
import { base, authed } from '../rpc/base'
import { fetchTaxonomy, getUserProfile, formatCustomerProfile } from './router.helpers'

const profile = authed.customer.profile.handler(async ({ context }) => {
  const userDoc = await getUserProfile(context.user.id)
  return formatCustomerProfile(userDoc)
})

const updateProfile = authed.customer.updateProfile.handler(async ({ input, context }) => {
  const updatedDoc = await sdk.update({
    collection: 'users',
    id: context.user.id,
    data: {
      fullName: input.contactName,
      companyName: input.storeName,
      nationalCode: input.nationalCode,
      economicCode: input.economicCode,
      province: input.province,
      city: input.city,
      address: input.address,
    },
  })
  return formatCustomerProfile(updatedDoc)
})

const types = base.customer.types.handler(async ({ input }) => {
  return fetchTaxonomy('customer-types', { onlyActive: input?.onlyActive })
})

export const customer = base.customer.router({
  profile,
  updateProfile,
  types,
})
