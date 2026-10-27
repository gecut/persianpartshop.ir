import { z } from 'zod'

export const IranianMobileSchema = z
  .string()
  .trim()
  .regex(/^09[0-9]{9}$/, 'شماره موبایل نامعتبر است. فرمت صحیح: ۰۹۱۲۳۴۵۶۷۸۹')

export const EntityIdSchema = z
  .string()
  .trim()
  .min(1, 'شناسه موجودیت الزامی است')

export const SlugSchema = z
  .string()
  .trim()
  .min(1, 'اسلاگ الزامی است')
  .regex(/^[a-z0-9-]+$/, 'اسلاگ فقط می‌تواند شامل حروف کوچک انگلیسی، اعداد و خط تیره (-) باشد')

export const PaginationInputSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type PaginationInput = z.infer<typeof PaginationInputSchema>

export function createPaginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    totalPages: z.number().int().nonnegative(),
  })
}

export const StandardErrorDataSchema = z.object({
  message: z.string(),
  code: z.string().optional(),
})

export type StandardErrorData = z.infer<typeof StandardErrorDataSchema>
