import type { CollectionAfterReadHook } from 'payload'

export const personalizePlanAfterRead: CollectionAfterReadHook = ({ doc, context }) => {
  const contextName =
    (context as any)?.name ||
    (context as any)?.user?.fullName ||
    (context as any)?.user?.companyName

  if (contextName) {
    doc.dynamicTitle = `${contextName} عزیز، این طرح برای شماست`
    const replaceText = (str: string) => {
      if (!str) return str
      return str
        .replace(/\{\{\s*user\.name\s*\}\}/gi, contextName)
        .replace(/\{\{\s*name\s*\}\}/gi, contextName)
        .replace(/\{name\}/gi, contextName)
        .replace(/\[نام\s*کاربر\]/gi, contextName)
    }
    if (doc.title) doc.title = replaceText(doc.title)
    if (doc.content) doc.content = replaceText(doc.content)
  } else {
    doc.dynamicTitle = doc.title
  }

  return doc
}
