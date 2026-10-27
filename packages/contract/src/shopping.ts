import { oc } from '@orpc/contract'
import { openapi } from '@orpc/openapi'
import { z } from 'zod'

export const MutateAddressInputSchema = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  province: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  addressDetail: z.string().optional(),
})

export type MutateAddressInput = z.infer<typeof MutateAddressInputSchema>

export const shoppingContract = {
  all: oc
    .meta(openapi({ method: 'GET', path: '/shopping/products', summary: 'دریافت تمامی محصولات خرید' }))
    .input(
      z
        .object({
          search: z.string().optional(),
          categoryId: z.union([z.string(), z.number()]).optional(),
          brandId: z.union([z.string(), z.number()]).optional(),
          limit: z.number().default(50).optional(),
          page: z.number().default(1).optional(),
        })
        .optional()
    )
    .output(z.any()),

  detail: oc
    .meta(openapi({ method: 'GET', path: '/shopping/products/{id}', summary: 'مشاهده جزییات خرید محصول' }))
    .input(
      z.object({
        id: z.union([z.string(), z.number()]),
      })
    )
    .output(z.any()),

  categories: oc
    .meta(openapi({ method: 'GET', path: '/shopping/categories', summary: 'لیست دسته‌بندی‌ها در خرید' }))
    .input(z.object({ onlyActive: z.boolean().optional() }).optional())
    .output(z.any()),

  brands: oc
    .meta(openapi({ method: 'GET', path: '/shopping/brands', summary: 'لیست برندها در خرید' }))
    .input(z.object({ onlyActive: z.boolean().optional() }).optional())
    .output(z.any()),

  tags: oc
    .meta(openapi({ method: 'GET', path: '/shopping/tags', summary: 'لیست تگ‌ها در خرید' }))
    .input(z.object({ onlyActive: z.boolean().optional() }).optional())
    .output(z.any()),

  calculateCartons: oc
    .meta(openapi({ method: 'POST', path: '/shopping/calculate-cartons', summary: 'محاسبه کارتن در خرید' }))
    .input(
      z.object({
        productId: z.string().optional(),
        requestedSqm: z.number().optional(),
        requestedArea: z.number().optional(),
        sqmPerCarton: z.number().optional(),
        pricePerSqm: z.number().optional(),
      })
    )
    .output(
      z.object({
        cartonCount: z.number(),
        deliverableArea: z.number(),
        totalPrice: z.number(),
      })
    ),

  cartProducts: oc
    .meta(openapi({ method: 'POST', path: '/shopping/cart-products', summary: 'دریافت محصولات سبد خرید با شناسه' }))
    .input(z.array(z.union([z.string(), z.number()])))
    .output(z.any()),

  addressList: oc
    .meta(openapi({ method: 'GET', path: '/shopping/addresses', summary: 'لیست آدرس‌های کاربر' }))
    .output(z.any())
    .errors({
      UNAUTHORIZED: {},
    }),

  mutateAddress: oc
    .meta(openapi({ method: 'POST', path: '/shopping/addresses', summary: 'ثبت یا ویرایش آدرس کاربر' }))
    .input(MutateAddressInputSchema)
    .output(z.any())
    .errors({
      UNAUTHORIZED: {},
    }),

  createOrder: oc
    .meta(openapi({ method: 'POST', path: '/shopping/create-order', summary: 'ثبت سفارش از طریق خرید' }))
    .input(z.any())
    .output(z.any())
    .errors({
      UNAUTHORIZED: {},
      BAD_REQUEST: {},
    }),

  verifyPayment: oc
    .meta(openapi({ method: 'POST', path: '/shopping/verify-payment', summary: 'بررسی وضعیت پرداخت' }))
    .input(z.any())
    .output(z.any())
    .errors({
      UNAUTHORIZED: {},
      NOT_FOUND: {},
      BAD_REQUEST: {},
    }),
}

export type ShoppingContract = typeof shoppingContract
