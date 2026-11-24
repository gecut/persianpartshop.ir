import type { CollectionBeforeChangeHook } from 'payload'
import { createBlurCss } from './media-blur'

/** Rebuilds the placeholder only when a file is uploaded or replaced; a failure never blocks the save. */
export const blurCssBeforeChange: CollectionBeforeChangeHook = async ({ data, req }) => {
  if (!req.file?.data) return data
  data.blurCSS = null
  try {
    data.blurCSS = await createBlurCss(req.file.data)
  } catch (error) {
    req.payload.logger.warn({ msg: 'Media blur placeholder failed', filename: req.file.name, cause: error })
  }
  return data
}
