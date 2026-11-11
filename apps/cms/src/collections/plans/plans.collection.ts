import { fieldError } from '../../lib/validation'
import type { CollectionConfig } from 'payload'
import { personalizePlanAfterRead } from './_personalize-plan.after-read'
import { isSalesManager, canManagePlans } from '../../access/roles'
import { logAction } from '../audit-logs/log-action'
import { SMS_TEMPLATES } from '../../modules/sms/constants'
import { enqueueSms } from '../../modules/sms/queue-service'

export const Plans: CollectionConfig = {
  slug: "plans",
  labels: {
    singular: "طرح اختصاصی",
    plural: "طرح‌ها و بسته‌ها",
  },
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "isActive", "startsAt", "expiresAt", "createdAt"],
    group: "فروش و مشتریان",
    description: "طرح‌ها، بسته‌ها و پیشنهادات ویژه مشتریان.",
  },
  access: {
    read: isSalesManager,
    create: canManagePlans,
    update: canManagePlans,
    delete: canManagePlans,
  },
  hooks: {
    beforeValidate: [({ data, originalDoc }) => {
      if (!data) return data
      const start = data.startsAt === undefined ? originalDoc?.startsAt : data.startsAt
      const end = data.expiresAt === undefined ? originalDoc?.expiresAt : data.expiresAt
      if (start && end && new Date(end).getTime() <= new Date(start).getTime()) fieldError('expiresAt', 'پایان طرح باید بعد از شروع آن باشد.')
      return data
    }],
    afterRead: [personalizePlanAfterRead],
    afterChange: [
      async ({ doc, previousDoc, operation, req, context }) => {
        if (context?.skipLogging) return;

        // 1. Audit Log
        const isCreate = operation === "create";
        await logAction({
          payload: req.payload,
          req,
          action: "other",
          entity: "admins",
          target: `طرح: ${doc.title || doc.id}`,
          details: isCreate
            ? "ایجاد طرح فروش اختصاصی"
            : "ویرایش مشخصات طرح فروش اختصاصی",
        });

        // 2. Enqueue SMS to newly assigned users (only for active plans)
        try {
          if (doc.isActive === false) return;

          const currentUsers: number[] = Array.isArray(doc.users)
            ? doc.users.map((u: any) =>
                typeof u === 'object' && u !== null ? u.id : Number(u),
              )
            : []

          const prevUsers: number[] = Array.isArray(previousDoc?.users)
            ? previousDoc.users.map((u: any) =>
                typeof u === 'object' && u !== null ? u.id : Number(u),
              )
            : []

          const wasActive = previousDoc?.isActive !== false
          const newlyActivated = !isCreate && !wasActive && doc.isActive === true

          const newRecipientIds = currentUsers.filter(
            (id) => isCreate || newlyActivated || !prevUsers.includes(id),
          )

          if (newRecipientIds.length > 0) {
            const planTitle = (doc.title || 'پیشنهاد ویژه').trim().slice(0, 40)
            for (const userId of newRecipientIds) {
              const userDoc: any = await req.payload.findByID({
                collection: 'users',
                req,
                id: userId,
                depth: 0,
                overrideAccess: true,
              })

              if (userDoc?.phone) {
                await enqueueSms(req.payload, {
                  receptor: userDoc.phone,
                  template: SMS_TEMPLATES.PLAN_ASSIGNED,
                  tokens: {
                    token: String(doc.id),
                    token10: planTitle,
                  },
                  req,
                })
              }
            }
          }
        } catch (smsErr) {
          req.payload.logger.error({ msg: '[PlanSMS] Error enqueueing plan SMS', err: smsErr })
        }
      },
    ],
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      label: "عنوان طرح",
      admin: {
        description: "عنوان طرح یا پیشنهاد ویژه",
      },
    },
    {
      name: "content",
      type: "textarea",
      required: true,
      label: "متن و شرایط کامل طرح",
      admin: {
        description: "توضیحات و شرایط استفاده از طرح برای خریدار",
      },
    },
    {
      name: "users",
      type: "relationship",
      relationTo: "users",
      hasMany: true,
      required: true,
      label: "مشتریان هدف",
      admin: {
        description: "با افزودن مشتری، پیامک اطلاع‌رسانی برای او ارسال می‌شود.",
      },
    },
    {
      name: "products",
      type: "relationship",
      relationTo: "products",
      hasMany: true,
      required: false,
      label: "محصولات مرتبط (اختیاری)",
      admin: {
        description: "کالاهایی که مشمول تخفیف یا شرایط ویژه این طرح هستند.",
      },
    },
    {
      type: "row",
      fields: [
        {
          name: "startsAt",
          type: "date",
          label: "تاریخ شروع طرح",
          admin: {
            width: "50%",
            description: "تاریخ و ساعت آغاز رسمی طرح",
          },
        },
        {
          name: "expiresAt",
          type: "date",
          label: "تاریخ پایان طرح",
          admin: {
            width: "50%",
            description:
              "تاریخ و ساعت پایان طرح (پس از پایان موعد، طرح منقضی اعلام می‌شود)",
          },
        },
      ],
    },
    {
      name: "isActive",
      type: "checkbox",
      defaultValue: true,
      label: "طرح فعال",
      admin: {
        position: "sidebar",
        description:
          "در صورت غیرفعال بودن، این طرح تحت هیچ شرایطی به مشتری نمایش داده نخواهد شد.",
      },
    },
  ],
};
