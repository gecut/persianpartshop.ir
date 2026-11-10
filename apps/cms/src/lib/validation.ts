import { APIError, ValidationError, type Config } from 'payload'

export function fieldError(path: string, message: string): never {
  const error = new ValidationError({ errors: [{ path, message }] })
  error.message = message
  throw error
}

export function businessError(message: string, code = 'BUSINESS_RULE', status = 409): APIError {
  return new APIError(message, status, { message, code }, true)
}

export function relationId(value: unknown): unknown {
  return value && typeof value === 'object' && 'id' in value ? value.id : value
}

export function sameRelation(a: unknown, b: unknown): boolean {
  const left = relationId(a), right = relationId(b)
  return left == null || right == null ? left == null && right == null : String(left) === String(right)
}

type AfterError = NonNullable<NonNullable<Config['hooks']>['afterError']>[number]

// A dependency created after the beforeDelete check is ultimately caught by the FK.
export const describeDeleteConflict: AfterError = ({ error, req }) => {
  if (req.method !== 'DELETE') return
  let cause: unknown = error
  for (let depth = 0; depth < 5 && cause && typeof cause === 'object'; depth++) {
    if ('code' in cause && cause.code === '23503') {
      const message = 'این رکورد هنوز وابستگی دارد؛ صفحه را دوباره دریافت کنید و ابتدا ارتباط رکورد وابسته را بردارید. سوابق فروش قابل حذف نیستند؛ مرجع آن‌ها را غیرفعال کنید.'
      return { status: 409, response: { errors: [{ message, data: { message, code: 'REFERENCE_IN_USE' } }] } }
    }
    cause = 'cause' in cause ? cause.cause : undefined
  }
}
