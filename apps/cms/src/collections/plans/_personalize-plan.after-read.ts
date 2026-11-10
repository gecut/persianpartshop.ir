import type { CollectionAfterReadHook } from 'payload'

export const personalizePlanAfterRead: CollectionAfterReadHook = ({ doc, context }) => {
  const user: unknown = context?.user
  const contextUser = user && typeof user === 'object' ? user : null
  const name = context?.name || (contextUser && 'fullName' in contextUser ? contextUser.fullName : null) || (contextUser && 'companyName' in contextUser ? contextUser.companyName : null)
  // Customer DTO mapping owns interpolation; raw templates remain safe to round-trip through admin.
  return { ...doc, dynamicTitle: typeof name === 'string' && name ? name + ' عزیز، این طرح برای شماست' : doc.title }
}
