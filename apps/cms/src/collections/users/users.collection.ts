import type { CollectionConfig } from "payload";
import {
  isSalesManager,
  canManageUsers,
  isSuperAdmin,
  canManageUsersField,
} from "../../access/roles";
import { logAction } from "../audit-logs/log-action";

export const Users: CollectionConfig = {
  slug: "users",
  labels: {
    singular: "مشتری",
    plural: "مشتریان",
  },
  admin: {
    useAsTitle: "fullName",
    defaultColumns: [
      "fullName",
      "phone",
      "customerType",
      "status",
      "companyName",
      "createdAt",
    ],
    group: "فروش و مشتریان",
    description: "فهرست مشتریان و خریداران تجاری.",
  },
  access: {
    read: isSalesManager,
    create: canManageUsers,
    update: canManageUsers,
    delete: isSuperAdmin,
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        return data;
      },
    ],
    beforeChange: [
      ({ data, originalDoc, req }) => {
        // 1. Sync ban state with account status
        if (data?.status === "suspended") {
          data.isBanned = true;
        } else if (data?.status === "active" || data?.status === "pending") {
          data.isBanned = false;
          if (originalDoc?.status === "suspended" && !data.banReason) {
            data.banReason = null;
          }
        } else if (data?.isBanned) {
          data.status = "suspended";
        }

        // Invariant: If customer cannot see exact stock, they cannot place orders
        if (data?.hideExactStock === true) {
          data.disableOrdering = true;
        }

        // 2. Lock approved documents against customer modification or deletion
        const isAdmin =
          (req as any).user?.collection === "admins" ||
          (req as any).user?.role === "superadmin" ||
          (req as any).user?.role === "manager";

        if (
          !isAdmin &&
          originalDoc?.documents &&
          Array.isArray(originalDoc.documents)
        ) {
          const approvedDocs = originalDoc.documents.filter(
            (d: any) => d.status === "approved",
          );
          if (approvedDocs.length > 0) {
            const incomingDocs = Array.isArray(data?.documents)
              ? data.documents
              : [];
            for (const approved of approvedDocs) {
              const matching = incomingDocs.find(
                (d: any) => String(d.id) === String(approved.id),
              );
              if (!matching) {
                throw new Error(
                  `مدرک تأیید شده «${approved.title || "ثبت شده"}» قابل حذف نیست.`,
                );
              }
              const origFileId =
                typeof approved.file === "object" && approved.file !== null
                  ? approved.file.id
                  : approved.file;
              const newFileId =
                typeof matching.file === "object" && matching.file !== null
                  ? matching.file.id
                  : matching.file;
              if (String(origFileId) !== String(newFileId)) {
                throw new Error(
                  `فایل مدرک تأیید شده «${approved.title || "ثبت شده"}» قابل ویرایش یا جایگزینی نیست.`,
                );
              }
              // Force status to remain approved
              matching.status = "approved";
            }
          }
        }

        // Ensure newly added documents have uploadedAt set
        if (Array.isArray(data?.documents)) {
          for (const doc of data.documents) {
            if (!doc.uploadedAt) {
              doc.uploadedAt = new Date().toISOString();
            }
          }
        }

        return data;
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req, context }) => {
        if (context?.skipLogging) return;
        const isCreate = operation === "create";
        let action: any = "user_update";
        let details = "";

        if (isCreate) {
          action = "user_create";
          details = `ثبت مشتری با شماره ${doc.phone}`;
        } else {
          const wasBanned =
            previousDoc?.isBanned || previousDoc?.status === "suspended";
          const isNowBanned = doc?.isBanned || doc?.status === "suspended";

          if (!wasBanned && isNowBanned) {
            action = "user_ban";
            details = `مسدودسازی مشتری. علت: ${doc.banReason || "بدون علت"}`;
          } else if (wasBanned && !isNowBanned) {
            action = "user_unban";
            details = `رفع مسدودی مشتری. وضعیت: ${doc.status === "active" ? "فعال" : doc.status}`;
          } else {
            action = "user_update";
            const changes: string[] = [];
            if (previousDoc?.status !== doc.status) {
              changes.push(`وضعیت: ${previousDoc?.status} -> ${doc.status}`);
            }
            if (previousDoc?.hideExactStock !== doc.hideExactStock) {
              changes.push(
                `عدم نمایش موجودی: ${doc.hideExactStock ? "فعال" : "غیرفعال"}`,
              );
            }
            if (previousDoc?.disableOrdering !== doc.disableOrdering) {
              changes.push(
                `عدم امکان سفارش: ${doc.disableOrdering ? "فعال" : "غیرفعال"}`,
              );
            }
            if (previousDoc?.fullName !== doc.fullName) {
              changes.push(
                `نام: ${previousDoc?.fullName} -> ${doc.fullName}`,
              );
            }
            if (previousDoc?.companyName !== doc.companyName) {
              changes.push(
                `شرکت: ${previousDoc?.companyName ?? "-"} -> ${doc.companyName ?? "-"}`,
              );
            }
            details =
              changes.length > 0
                ? changes.join(" | ")
                : "ویرایش مشخصات مشتری";
          }
        }

        await logAction({
          payload: req.payload,
          req,
          action,
          entity: "users",
          target: `${doc.fullName || "مشتری"} (${doc.phone})`,
          details,
        });
      },
    ],
    afterDelete: [
      async ({ doc, id, req, context }) => {
        if (context?.skipLogging) return;
        await logAction({
          payload: req.payload,
          req,
          action: "user_delete",
          entity: "users",
          target: `${doc?.fullName || "مشتری"} (${doc?.phone || id})`,
          details: `حذف پرونده مشتری #${id}`,
        });
      },
    ],
  },
  fields: [
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "active",
      label: "وضعیت حساب",
      access: {
        update: canManageUsersField,
      },
      admin: {
        position: "sidebar",
      },
      options: [
        { label: "فعال", value: "active" },
        { label: "در انتظار بررسی", value: "pending" },
        { label: "مسدود", value: "suspended" },
      ],
    },
    // --- فیلدهای سایدبار (وضعیت، رده و دسترسی) ---
    {
      name: "customerType",
      type: "relationship",
      relationTo: "customer-types",
      required: true,
      label: "رده مشتری",
      access: {
        update: canManageUsersField,
      },
      admin: {
        position: "sidebar",
        description: "تعیین‌کننده درصد تخفیف و رده قیمت کاتالوگ.",
      },
    },
    {
      name: "isBanned",
      type: "checkbox",
      defaultValue: false,
      admin: {
        hidden: true,
      },
    },
    // --- فیلدهای محتوای اصلی (تب‌بندی شده) ---
    {
      type: "tabs",
      tabs: [
        {
          label: "مشخصات و آدرس‌ها",
          fields: [
            {
              type: "row",
              fields: [
                {
                  name: "fullName",
                  type: "text",
                  required: true,
                  label: "نام خریدار",
                  admin: {
                    width: "50%",
                    description: "نام و نام خانوادگی خریدار یا نماینده خرید.",
                  },
                },
                {
                  name: "phone",
                  type: "text",
                  required: true,
                  unique: true,
                  label: "شماره همراه",
                  admin: {
                    width: "50%",
                    description: "شناسه ورود مشتری با کد یکبار مصرف (OTP).",
                  },
                },
              ],
            },
            {
              type: "row",
              fields: [
                {
                  name: "companyName",
                  type: "text",
                  label: "نام تجاری",
                  admin: {
                    width: "33.3%",
                    description: "نام فروشگاه، شرکت یا پروژه ساختمانی.",
                  },
                },
                {
                  name: "nationalCode",
                  type: "text",
                  label: "کد ملی",
                  admin: {
                    width: "33.3%",
                    description: "کد ملی جهت صدور فاکتور رسمی خریدار.",
                  },
                },
                {
                  name: "economicCode",
                  type: "text",
                  label: "کد اقتصادی",
                  admin: {
                    width: "33.3%",
                    description: "شناسه اقتصادی جهت ثبت در گزارش فصلی.",
                  },
                },
              ],
            },
            {
              type: "row",
              fields: [
                {
                  name: "province",
                  type: "text",
                  label: "استان",
                  admin: {
                    width: "50%",
                    description: "استان محل فعالیت یا اقامت.",
                  },
                },
                {
                  name: "city",
                  type: "text",
                  label: "شهر",
                  admin: {
                    width: "50%",
                    description: "شهر محل فعالیت.",
                  },
                },
              ],
            },
            {
              name: "address",
              type: "textarea",
              label: "نشانی اصلی",
              admin: {
                description: "آدرس دفتر، انبار یا فروشگاه مرکزی.",
              },
            },
            {
              name: "addresses",
              type: "array",
              label: "آدرس‌های تحویل",
              labels: {
                singular: "نشانی",
                plural: "نشانی‌ها",
              },
              fields: [
                {
                  name: "title",
                  type: "text",
                  required: true,
                  label: "عنوان آدرس",
                  admin: {
                    description: "مثال: انبار مرکزی، پروژه شماره ۲ و...",
                  },
                },
                {
                  type: "row",
                  fields: [
                    {
                      name: "province",
                      type: "text",
                      required: true,
                      label: "استان",
                      admin: { width: "50%" },
                    },
                    {
                      name: "city",
                      type: "text",
                      required: true,
                      label: "شهر",
                      admin: { width: "50%" },
                    },
                  ],
                },
                {
                  name: "postalCode",
                  type: "text",
                  label: "کد پستی",
                },
                {
                  name: "addressDetail",
                  type: "textarea",
                  required: true,
                  label: "نشانی کامل",
                },
              ],
            },
          ],
        },
        {
          label: "آپلود مدارک",
          fields: [
            {
              name: "documents",
              type: "array",
              label: "مدارک صنفی و هویتی",
              labels: {
                singular: "مدرک",
                plural: "مدارک",
              },
              admin: {
                description:
                  "مدارک هویتی و صنفی بارگذاری‌شده توسط مشتری (مشاهده و بررسی مدیر).",
              },
              fields: [
                {
                  type: "row",
                  fields: [
                    {
                      name: "documentType",
                      type: "select",
                      required: true,
                      defaultValue: "business_license",
                      label: "نوع مدرک",
                      admin: {
                        readOnly: true,
                        width: "50%",
                        description: "نوع مدرک انتخاب شده توسط کاربر (فقط‌خواندنی)",
                      },
                      options: [
                        { label: "پروانه کسب", value: "business_license" },
                        { label: "جواز تأسیس", value: "establishment_license" },
                        { label: "پروانه بهره‌برداری", value: "operating_license" },
                        { label: "گواهی ثبت‌نام در نظام صنفی", value: "trade_guild_registration" },
                        { label: "گواهی عضویت در اتحادیه صنفی", value: "union_membership" },
                        { label: "مجوز فعالیت از مراجع ذیصلاح", value: "competent_authorities_permit" },
                        { label: "کارت مباشرت یا معرفی‌نامه نماینده کسب‌وکار", value: "stewardship_card_or_letter" },
                        { label: "گواهی نمایندگی فروش یا عاملیت رسمی", value: "sales_agency_certificate" },
                        { label: "گواهی نمایندگی برند", value: "brand_agency_certificate" },
                        { label: "گواهی استاندارد یا مجوز تخصصی، در صورت نیاز", value: "standard_certificate" },
                        { label: "غیره", value: "other" },
                      ],
                    },
                    {
                      name: "title",
                      type: "text",
                      label: "عنوان یا توضیحات مدرک",
                      admin: {
                        readOnly: true,
                        width: "50%",
                        description: "عنوان یا توضیحات تکمیلی مدرک",
                      },
                    },
                  ],
                },
                {
                  name: "file",
                  type: "upload",
                  relationTo: "media",
                  required: true,
                  label: "فایل مدرک (تصویر)",
                  admin: {
                    readOnly: true,
                  },
                },
                {
                  type: "row",
                  fields: [
                    {
                      name: "status",
                      type: "select",
                      defaultValue: "pending",
                      required: true,
                      label: "وضعیت بررسی مدرک",
                      access: {
                        update: canManageUsersField,
                      },
                      admin: {
                        width: "50%",
                        description: "وضعیت تأیید مدرک توسط مدیریت پرشین پارت.",
                      },
                      options: [
                        { label: "منتظر تایید ادمین", value: "pending" },
                        { label: "تایید شده", value: "approved" },
                        { label: "لغو شده", value: "rejected" },
                      ],
                    },
                    {
                      name: "rejectionReason",
                      type: "text",
                      label: "علت لغو / رد مدرک",
                      access: {
                        update: canManageUsersField,
                      },
                      admin: {
                        width: "50%",
                        condition: (_data, siblingData) =>
                          siblingData?.status === "rejected",
                        description:
                          "توضیحات و علت عدم تأیید مدرک جهت اطلاع‌رسانی به مشتری.",
                      },
                    },
                  ],
                },
                {
                  name: "uploadedAt",
                  type: "date",
                  label: "تاریخ بارگذاری",
                  admin: {
                    readOnly: true,
                  },
                },
              ],
            },
          ],
        },
        { label: 'دسترسی و فروش', fields: [
          {
      name: "allowedCategories",
      type: "relationship",
      relationTo: "categories",
      hasMany: true,
      label: "دسته‌بندی‌های مجاز",
      access: {
        update: canManageUsersField,
      },
      admin: {
        description: "خالی = دسترسی کامل به کاتالوگ",
      },
    },
          {
      name: "hideExactStock",
      type: "checkbox",
      defaultValue: false,
      label: "موجودی به‌صورت موجود/ناموجود",
      access: {
        update: canManageUsersField,
      },
      admin: {
        description: "مخفی‌سازی عدد موجودی (با فعال‌سازی، ثبت سفارش برای مشتری غیرفعال می‌شود)",
      },
    },
          {
      name: "canUseProductQr",
      type: "checkbox",
      defaultValue: false,
      label: "اسکن و دریافت QR محصولات",
      access: { update: canManageUsersField, create: canManageUsersField },
      admin: { description: "اجازهٔ اسکن و دریافت QR محصولات قابل مشاهده." },
    },
          {
      name: "disableOrdering",
      type: "checkbox",
      defaultValue: false,
      label: "فقط مشاهده کاتالوگ (غیرفعال‌سازی ثبت سفارش)",
      access: {
        update: canManageUsersField,
      },
      admin: {
      },
    },
        ] },
        { label: 'یادداشت داخلی', fields: [
          {
      name: "notes",
      type: "textarea",
      label: "یادداشت داخلی",
      admin: {
        description: "یادداشت‌های اختصاصی مدیران فروش درباره سابقه مشتری.",
      },
    },
        ] },
        { label: 'وضعیت حساب', fields: [
          {
      name: "banReason",
      type: "textarea",
      label: "علت مسدودی",
      access: {
        update: canManageUsersField,
      },
      admin: {
        condition: (data) =>
          data?.status === "suspended" || Boolean(data?.isBanned),
        description: "پیام خطا هنگام ورود",
      },
    },
        ] },
      ],
    },

  ],
};
