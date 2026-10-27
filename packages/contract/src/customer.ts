import { oc } from '@orpc/contract'
import { openapi } from '@orpc/openapi'
import { z } from 'zod'
import {
  EntityIdSchema,
  IranianMobileSchema,
  PaginationInputSchema,
  SlugSchema,
  StandardErrorDataSchema,
} from './common'

// ============================================================================
// 1. Customer Types & Pricing Tiers Schemas
// ============================================================================

export const CustomerTypeSchema = z.object({
  id: EntityIdSchema,
  name: z.string().min(1, 'نام نوع مشتری الزامی است'),
  slug: SlugSchema,
  markupPercent: z
    .number()
    .min(-50, 'درصد سود نمی‌تواند کمتر از -۵۰ باشد')
    .max(500, 'درصد سود نمی‌تواند بیشتر از ۵۰۰ باشد'),
  isActive: z.boolean().default(true),
  description: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type CustomerType = z.infer<typeof CustomerTypeSchema>

export const CreateCustomerTypeInputSchema = z.object({
  name: z.string().min(1, 'نام نوع مشتری الزامی است'),
  slug: SlugSchema,
  markupPercent: z
    .number()
    .min(-50, 'درصد سود نمی‌تواند کمتر از -۵۰ باشد')
    .max(500, 'درصد سود نمی‌تواند بیشتر از ۵۰۰ باشد'),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
})

export type CreateCustomerTypeInput = z.infer<typeof CreateCustomerTypeInputSchema>

export const UpdateCustomerTypeInputSchema = z.object({
  id: EntityIdSchema,
  name: z.string().min(1).optional(),
  slug: SlugSchema.optional(),
  markupPercent: z.number().min(-50).max(500).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
})

export type UpdateCustomerTypeInput = z.infer<typeof UpdateCustomerTypeInputSchema>

// ============================================================================
// 2. Customer Profile Schemas
// ============================================================================

export const CustomerProfileSchema = z.object({
  id: EntityIdSchema,
  storeName: z.string().min(1, 'نام فروشگاه/کسب‌وکار الزامی است'),
  contactName: z.string().min(1, 'نام شخص رابط الزامی است'),
  mobile: IranianMobileSchema,
  phone: z.string().optional(),
  province: z.string().min(1, 'استان الزامی است'),
  city: z.string().min(1, 'شهر الزامی است'),
  address: z.string().min(1, 'آدرس الزامی است'),
  customerTypeId: EntityIdSchema,
  customerType: CustomerTypeSchema.pick({
    id: true,
    name: true,
    slug: true,
  }).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type CustomerProfile = z.infer<typeof CustomerProfileSchema>

export const CreateCustomerInputSchema = z.object({
  storeName: z.string().min(1, 'نام فروشگاه الزامی است'),
  contactName: z.string().min(1, 'نام شخص رابط الزامی است'),
  mobile: IranianMobileSchema,
  phone: z.string().optional(),
  province: z.string().min(1, 'استان الزامی است'),
  city: z.string().min(1, 'شهر الزامی است'),
  address: z.string().min(1, 'آدرس الزامی است'),
  customerTypeId: EntityIdSchema,
  internalNotes: z.string().optional(),
  isActive: z.boolean().default(true),
})

export type CreateCustomerInput = z.infer<typeof CreateCustomerInputSchema>

export const UpdateCustomerInputSchema = z.object({
  id: EntityIdSchema,
  storeName: z.string().min(1).optional(),
  contactName: z.string().min(1).optional(),
  phone: z.string().optional(),
  province: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  customerTypeId: EntityIdSchema.optional(),
  internalNotes: z.string().optional(),
  isActive: z.boolean().optional(),
})

export type UpdateCustomerInput = z.infer<typeof UpdateCustomerInputSchema>

export const UpdateCustomerProfileInputSchema = z.object({
  storeName: z.string().min(1).optional(),
  contactName: z.string().min(1).optional(),
  phone: z.string().optional(),
  province: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  nationalCode: z.string().optional(),
  economicCode: z.string().optional(),
})

export type UpdateCustomerProfileInput = z.infer<typeof UpdateCustomerProfileInputSchema>

export const CustomerFilterInputSchema = PaginationInputSchema.extend({
  search: z.string().optional(),
  customerTypeId: EntityIdSchema.optional(),
  isActive: z.coerce.boolean().optional(),
})

export type CustomerFilterInput = z.infer<typeof CustomerFilterInputSchema>

// ============================================================================
// 3. Unified Customer & Customer Types Contract
// ============================================================================

export const customerTypeContract = {
  list: oc
    .meta(openapi({ method: 'GET', path: '/customer-types', summary: 'دریافت لیست انواع مشتری' }))
    .output(z.array(CustomerTypeSchema)),

  getById: oc
    .meta(openapi({ method: 'GET', path: '/customer-types/{id}', summary: 'دریافت تکی نوع مشتری' }))
    .input(z.object({ id: EntityIdSchema }))
    .output(CustomerTypeSchema)
    .errors({ NOT_FOUND: { data: StandardErrorDataSchema } }),

  create: oc
    .meta(openapi({ method: 'POST', path: '/customer-types', summary: 'ایجاد نوع مشتری جدید (فقط ادمین)' }))
    .input(CreateCustomerTypeInputSchema)
    .output(CustomerTypeSchema)
    .errors({
      CONFLICT: { data: StandardErrorDataSchema },
      FORBIDDEN: { data: StandardErrorDataSchema },
    }),

  update: oc
    .meta(openapi({ method: 'PUT', path: '/customer-types/{id}', summary: 'ویرایش نوع مشتری (فقط ادمین)' }))
    .input(UpdateCustomerTypeInputSchema)
    .output(CustomerTypeSchema)
    .errors({
      NOT_FOUND: { data: StandardErrorDataSchema },
      CONFLICT: { data: StandardErrorDataSchema },
      FORBIDDEN: { data: StandardErrorDataSchema },
    }),

  toggleActive: oc
    .meta(openapi({ method: 'POST', path: '/customer-types/{id}/toggle-active', summary: 'فعال/غیرفعال‌سازی نوع مشتری' }))
    .input(z.object({ id: EntityIdSchema }))
    .output(CustomerTypeSchema)
    .errors({
      NOT_FOUND: { data: StandardErrorDataSchema },
      FORBIDDEN: { data: StandardErrorDataSchema },
    }),
}

export const customerContract = {
  profile: oc
    .meta(openapi({ method: 'GET', path: '/customer/profile', summary: 'دریافت پروفایل مشتری جاری' }))
    .output(CustomerProfileSchema.or(z.any()).nullable()),

  updateProfile: oc
    .meta(openapi({ method: 'PUT', path: '/customer/profile', summary: 'ویرایش اطلاعات پروفایل توسط مشتری' }))
    .input(
      z.object({
        contactName: z.string().optional(),
        storeName: z.string().optional(),
        nationalCode: z.string().optional(),
        economicCode: z.string().optional(),
        province: z.string().optional(),
        city: z.string().optional(),
        address: z.string().optional(),
      })
    )
    .output(CustomerProfileSchema.or(z.any()).nullable()),

  types: oc
    .meta(openapi({ method: 'GET', path: '/customer/types', summary: 'دریافت لیست انواع مشتری' }))
    .input(z.object({ onlyActive: z.boolean().optional() }).optional())
    .output(z.array(CustomerTypeSchema).or(z.any())),
}

export type CustomerContract = typeof customerContract

export const userContract = {
  profile: oc
    .meta(openapi({ method: 'GET', path: '/user/profile', summary: 'دریافت پروفایل کاربر' }))
    .output(z.any())
    .errors({
      UNAUTHORIZED: {},
    }),

  list: oc
    .meta(openapi({ method: 'GET', path: '/user/list', summary: 'لیست کاربران سیستم' }))
    .input(
      z
        .object({
          limit: z.number().optional(),
          search: z.string().optional(),
        })
        .optional()
    )
    .output(z.array(z.any()).or(z.any())),

  update: oc
    .meta(openapi({ method: 'PUT', path: '/user/profile', summary: 'به‌روزرسانی اطلاعات کاربر' }))
    .input(
      z.object({
        fullName: z.string().optional(),
        companyName: z.string().optional(),
        nationalCode: z.string().optional(),
        economicCode: z.string().optional(),
        province: z.string().optional(),
        city: z.string().optional(),
        address: z.string().optional(),
        addresses: z.any().optional(),
      })
    )
    .output(z.any())
    .errors({
      UNAUTHORIZED: {},
      FORBIDDEN: {},
      BAD_REQUEST: {},
    }),

  delete: oc
    .meta(openapi({ method: 'DELETE', path: '/user/{id}', summary: 'حذف کاربر' }))
    .input(
      z.object({
        id: z.union([EntityIdSchema, z.number()]),
      })
    )
    .output(z.any()),

  customerTypes: oc
    .meta(openapi({ method: 'GET', path: '/user/customer-types', summary: 'لیست انواع مشتری' }))
    .input(
      z
        .object({
          onlyActive: z.boolean().optional(),
        })
        .optional()
    )
    .output(z.array(CustomerTypeSchema).or(z.any())),
}

export type UserContract = typeof userContract
