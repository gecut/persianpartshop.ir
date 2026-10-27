import { oc } from '@orpc/contract'
import { openapi } from '@orpc/openapi'
import { z } from 'zod'
import { EntityIdSchema } from './common'

export const PlanStatusSchema = z.enum(['active', 'expired', 'draft'])
export type PlanStatus = z.infer<typeof PlanStatusSchema>

export const PlanTypeSchema = z.enum(['credit_terms', 'product_discount', 'informational'])
export type PlanType = z.infer<typeof PlanTypeSchema>

export const PlanSchema = z.object({
  id: EntityIdSchema,
  title: z.string().optional(),
  dynamicTitle: z.string().optional(),
  users: z.array(z.union([z.number(), z.string(), z.record(z.unknown())])).optional(),
  content: z.string().optional(),
  notes: z.string().optional(),
  type: PlanTypeSchema.optional(),
  discountPercent: z.number().optional(),
  discountAmount: z.number().optional(),
  status: PlanStatusSchema.default('active'),
  products: z.array(z.union([z.number(), z.string(), z.record(z.unknown())])).optional(),
  hasTimer: z.boolean().default(false).optional(),
  expiresAt: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

export type PlanDto = z.infer<typeof PlanSchema>

export const ListPlansInputSchema = z
  .object({
    status: PlanStatusSchema.optional(),
    userId: z.union([z.number(), z.string()]).optional(),
    page: z.number().optional(),
    limit: z.number().optional(),
  })
  .optional()

export type ListPlansInput = z.infer<typeof ListPlansInputSchema>

export const ListPlansOutputSchema = z.object({
  items: z.array(z.any()),
  total: z.number(),
})

export type ListPlansOutput = z.infer<typeof ListPlansOutputSchema>

export const CreatePlanInputSchema = z.object({
  title: z.string().optional(),
  users: z.array(z.union([z.number(), z.string()])).min(1, 'حداقل یک کاربر باید انتخاب شود'),
  content: z.string().min(1, 'متن پیام الزامی است'),
  type: PlanTypeSchema.default('credit_terms').optional(),
  discountPercent: z.number().optional(),
  discountAmount: z.number().optional(),
  status: PlanStatusSchema.default('active'),
  products: z.array(z.union([z.number(), z.string()])).optional(),
  hasTimer: z.boolean().default(false).optional(),
  expiresAt: z.string().optional(),
})

export type CreatePlanInput = z.infer<typeof CreatePlanInputSchema>

export const UpdatePlanInputSchema = z.object({
  id: z.union([z.number(), z.string()]),
  title: z.string().optional(),
  users: z.array(z.union([z.number(), z.string()])).optional(),
  content: z.string().optional(),
  type: PlanTypeSchema.optional(),
  discountPercent: z.number().optional(),
  discountAmount: z.number().optional(),
  status: PlanStatusSchema.optional(),
  products: z.array(z.union([z.number(), z.string()])).optional(),
  hasTimer: z.boolean().optional(),
  expiresAt: z.string().optional(),
})

export type UpdatePlanInput = z.infer<typeof UpdatePlanInputSchema>

export const planContract = {
  list: oc
    .meta(openapi({ method: 'GET', path: '/plans', summary: 'دریافت لیست طرح‌های اعتباری و تخفیف مشتری' }))
    .input(ListPlansInputSchema)
    .output(ListPlansOutputSchema),

  getById: oc
    .meta(openapi({ method: 'GET', path: '/plans/{id}', summary: 'مشاهده جزییات طرح با شناسه' }))
    .input(z.object({ id: z.union([z.number(), z.string()]) }))
    .output(z.any())
    .errors({
      NOT_FOUND: {},
    }),

  create: oc
    .meta(openapi({ method: 'POST', path: '/plans', summary: 'ایجاد طرح اعتباری یا تخفیفی اختصاصی' }))
    .input(CreatePlanInputSchema)
    .output(z.any()),

  update: oc
    .meta(openapi({ method: 'PUT', path: '/plans/{id}', summary: 'ویرایش طرح اعتباری یا تخفیفی اختصاصی' }))
    .input(UpdatePlanInputSchema)
    .output(z.any()),
}

export type PlanContract = typeof planContract
