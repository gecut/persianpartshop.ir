import type { CollectionConfig } from "payload";
import { personalizePlanAfterRead } from "./_personalize-plan.after-read";
import { isSalesManager, canManagePlans } from "../../access/roles";
import { logAction } from "../audit-logs/log-action";
import { sendSmsNotification } from "../../lib/sms";

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

        // 2. Send SMS to newly assigned users
        try {
          const currentUsers: number[] = Array.isArray(doc.users)
            ? doc.users.map((u: any) =>
                typeof u === "object" && u !== null ? u.id : Number(u),
              )
            : [];

          const prevUsers: number[] = Array.isArray(previousDoc?.users)
            ? previousDoc.users.map((u: any) =>
                typeof u === "object" && u !== null ? u.id : Number(u),
              )
            : [];

          const newRecipientIds = currentUsers.filter(
            (id) => isCreate || !prevUsers.includes(id),
          );

          if (newRecipientIds.length > 0) {
            for (const userId of newRecipientIds) {
              const userDoc: any = await req.payload.findByID({
                collection: "users",
                id: userId,
                depth: 0,
              });

              if (userDoc?.phone) {
                const planTitle = doc.title || "پیشنهاد ویژه";
                const smsMessage = `همکار گرامی ${userDoc.fullName || ""}\nطرح اختصاصی «${planTitle}» برای شما فعال شد.\nمشاهده جزئیات: persianpartshop.ir/plans`;

                await sendSmsNotification({
                  receptor: userDoc.phone,
                  message: smsMessage,
                });
              }
            }
          }
        } catch (smsErr) {
          console.error("Plan SMS dispatch error:", smsErr);
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
        position: "sidebar",
        description: "خریدارانی که این طرح به آن‌ها تخصیص داده می‌شود.",
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
