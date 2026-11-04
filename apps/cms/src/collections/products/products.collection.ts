import type { CollectionConfig } from "payload";
import { syncSlugAndDimensions } from "./_sync-slug-and-dimensions.before-validate";
import { isCatalogManager } from "../../access/roles";
import { logAction } from "../audit-logs/log-action";
import {
  canUpdateOperationalPrice,
  canUpdateOperationalInventory,
} from "./_product-access";

export const Products: CollectionConfig = {
  slug: "products",
  labels: {
    singular: "محصول",
    plural: "محصولات",
  },
  admin: {
    useAsTitle: "name",
    defaultColumns: [
      "name",
      "sku",
      "sqmPerCarton",
      "stockCartons",
      "isActive",
      "updatedAt",
    ],
    group: "کاتالوگ و انبارداری",
    description: "کاتالوگ و موجودی محصولات.",
  },
  access: {
    read: () => true,
    create: isCatalogManager,
    update: isCatalogManager,
    delete: isCatalogManager,
  },
  hooks: {
    beforeValidate: [syncSlugAndDimensions],
    afterChange: [
      async ({ doc, previousDoc, operation, req, context }) => {
        if (context?.skipLogging) return;
        const isCreate = operation === "create";
        let details = "";
        if (isCreate) {
          details = `ایجاد کالا با کد ${doc.sku || doc.id}`;
        } else {
          const changes: string[] = [];
          if (previousDoc?.basePricePerSqm !== doc.basePricePerSqm) {
            changes.push(
              `قیمت پایه: ${previousDoc?.basePricePerSqm?.toLocaleString?.("fa-IR") ?? "-"} -> ${doc.basePricePerSqm?.toLocaleString?.("fa-IR") ?? "-"}`,
            );
          }
          if (previousDoc?.stockCartons !== doc.stockCartons) {
            changes.push(
              `موجودی کارتن: ${previousDoc?.stockCartons ?? "-"} -> ${doc.stockCartons ?? "-"}`,
            );
          }
          if (previousDoc?.inventorySqm !== doc.inventorySqm) {
            changes.push(
              `موجودی متراژ: ${previousDoc?.inventorySqm ?? "-"} -> ${doc.inventorySqm ?? "-"}`,
            );
          }
          if (previousDoc?.isActive !== doc.isActive) {
            changes.push(
              `وضعیت انتشار: ${previousDoc?.isActive ? "فعال" : "غیرفعال"} -> ${doc.isActive ? "فعال" : "غیرفعال"}`,
            );
          }
          if (previousDoc?.name !== doc.name) {
            changes.push(`عنوان: «${previousDoc?.name}» -> «${doc.name}»`);
          }
          details = changes.length > 0 ? changes.join(" | ") : "ویرایش مشخصات کالا";
        }

        await logAction({
          payload: req.payload,
          req,
          action: isCreate ? "product_create" : "product_update",
          entity: "products",
          target: `${doc.name || "محصول"} (کد: ${doc.sku || doc.id})`,
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
          action: "product_delete",
          entity: "products",
          target: `${doc?.name || "محصول"} (شناسه: ${id})`,
          details: `حذف کالا با کد ${doc?.sku || id}`,
        });
      },
    ],
  },
  fields: [
    // --- فیلدهای سایدبار (مدیریت وضعیت و متادیتا) ---
    {
      name: "isActive",
      type: "checkbox",
      defaultValue: true,
      label: "وضعیت انتشار",
      admin: {
        position: "sidebar",
        description: "در صورت فعال بودن، در کاتالوگ فروشگاه نمایش داده می‌شود.",
      },
    },
    {
      name: "productType",
      type: "select",
      defaultValue: "tile",
      label: "نوع محصول",
      admin: {
        position: "sidebar",
      },
      options: [
        { label: "کاشی و سرامیک", value: "tile" },
        { label: "سایر اقلام (چسب و ملزومات)", value: "other" },
      ],
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      label: "اسلاگ URL",
      admin: {
        position: "sidebar",
        description:
          "شناسه یکتا در آدرس صفحه وبسایت (تولید خودکار از روی کد کالا).",
      },
    },
    {
      name: "category",
      type: "relationship",
      relationTo: "categories",
      label: "دسته‌بندی",
      admin: {
        position: "sidebar",
        description: "گروه کالایی تخصصی در کاتالوگ فروشگاه.",
      },
    },
    {
      name: "brand",
      type: "relationship",
      relationTo: "brands",
      label: "برند / کارخانه",
      admin: {
        position: "sidebar",
        description: "کارخانه یا برند سازنده کالا.",
      },
    },
    {
      name: "grade",
      type: "select",
      label: "درجه کیفی (اختیاری)",
      admin: {
        position: "sidebar",
        description:
          "درجه‌بندی استاندارد کیفیت کارخانه‌ای (اختیاری برای تمام محصولات).",
      },
      options: [
        { label: "درجه ۱", value: "grade_1" },
        { label: "درجه ۲", value: "grade_2" },
        { label: "درجه ۳", value: "grade_3" },
        { label: "درجه ۴", value: "grade_4" },
      ],
    },
    {
      name: "color",
      type: "text",
      label: "رنگ غالب",
      admin: {
        position: "sidebar",
        description: "طیف رنگی اصلی کالا (مثال: سفید، طوسی، کرم).",
      },
    },
    {
      name: "tags",
      type: "relationship",
      relationTo: "tags",
      hasMany: true,
      label: "برچسب‌ها",
      admin: {
        position: "sidebar",
        description: "ویژگی‌های کاربردی و فنی کالا.",
      },
    },

    // --- فیلدهای محتوای اصلی (تب‌بندی شده) ---
    {
      type: "tabs",
      tabs: [
        {
          label: "اطلاعات و انبارداری",
          fields: [
            {
              type: "row",
              fields: [
                {
                  name: "name",
                  type: "text",
                  required: true,
                  label: "نام کالا",
                  admin: {
                    width: "60%",
                    description: "عنوان تجاری و رسمی کالا در فروشگاه و فاکتور.",
                  },
                },
                {
                  name: "sku",
                  type: "text",
                  required: true,
                  unique: true,
                  label: "کد کالا (SKU)",
                  admin: {
                    width: "40%",
                    description: "شناسه یکتای انبارداری کالا جهت تطبیق موجودی.",
                  },
                },
              ],
            },
            {
              type: "row",
              fields: [
                {
                  name: "basePricePerSqm",
                  type: "number",
                  defaultValue: 0,
                  label: "قیمت پایه (تومان)",
                  admin: {
                    width: "33.3%",
                    description:
                      "قیمت پایه (برای کاشی بر حسب متر مربع، برای اقلام غیره بر حسب هر واحد/بسته).",
                  },
                  access: {
                    update: canUpdateOperationalPrice,
                    create: canUpdateOperationalPrice,
                  },
                },
                {
                  name: "sqmPerCarton",
                  type: "number",
                  required: false,
                  defaultValue: 1.44,
                  label: "متراژ کارتن (م²)",
                  admin: {
                    width: "33.3%",
                    description:
                      "ضریب متراژ فیزیکی در هر کارتن (مخصوص کاشی و سرامیک).",
                    condition: (data) =>
                      !data?.productType || data?.productType === "tile",
                  },
                },
                {
                  name: "inventorySqm",
                  type: "number",
                  required: false,
                  defaultValue: 0,
                  label: "موجودی (م² یا تعداد)",
                  admin: {
                    width: "33.3%",
                    description:
                      "موجودی قابل سفارش (برای کاشی بر حسب متر مربع، برای اقلام غیره بر حسب تعداد واحد/بسته).",
                  },
                  access: {
                    update: canUpdateOperationalInventory,
                    create: canUpdateOperationalInventory,
                  },
                },
              ],
            },
            {
              name: "stockCartons",
              type: "number",
              label: "تعداد کارتن (محاسبه خودکار)",
              defaultValue: 0,
              admin: {
                readOnly: true,
                description:
                  "محاسبه سیستمی در سرور: حاصل تقسیم موجودی بر متراژ کارتن.",
                condition: (data) =>
                  !data?.productType || data?.productType === "tile",
              },
            },
            {
              name: "productPreviewUi",
              type: "ui",
              admin: {
                components: {
                  Field:
                    "/collections/products/components/ProductPreview#ProductPreview",
                },
              },
            },
            // --- مشخصات و ابعاد فیزیکی مخصوص کاشی و سرامیک ---
            {
              type: "collapsible",
              label: "ابعاد و بسته‌بندی فیزیکی کاشی",
              admin: {
                condition: (data) =>
                  !data?.productType || data?.productType === "tile",
              },
              fields: [
                {
                  name: "dimension",
                  type: "relationship",
                  relationTo: "dimensions",
                  required: false,
                  label: "سایز / ابعاد (اختیاری)",
                  admin: {
                    description: "انتخاب سایز استاندارد کالا از لیست ابعاد.",
                  },
                },
                {
                  type: "row",
                  fields: [
                    {
                      name: "width",
                      type: "number",
                      label: "عرض (cm)",
                      admin: {
                        readOnly: true,
                        width: "50%",
                        description: "عرض همگام‌شده پس از ذخیره.",
                      },
                    },
                    {
                      name: "height",
                      type: "number",
                      label: "طول (cm)",
                      admin: {
                        readOnly: true,
                        width: "50%",
                        description: "طول همگام‌شده پس از ذخیره.",
                      },
                    },
                  ],
                },
                {
                  name: "piecesPerCarton",
                  type: "number",
                  defaultValue: 4,
                  label: "تعداد قطعه در کارتن (اختیاری)",
                  admin: {
                    description:
                      "تعداد فیزیکی قالب/اسلب کاشی در کارتن (مستقل از متراژ).",
                  },
                },
              ],
            },
            // --- مشخصات فنی اقلام غیر کاشی (چسب، پودر، ملزومات) ---
            {
              type: "collapsible",
              label: "مشخصات اقلام غیرکاشی (چسب و ملزومات)",
              admin: {
                condition: (data) => data?.productType === "other",
              },
              fields: [
                {
                  type: "row",
                  fields: [
                    {
                      name: "unit",
                      type: "select",
                      defaultValue: "bag",
                      label: "واحد فروش",
                      admin: {
                        width: "50%",
                      },
                      options: [
                        { label: "کیسه", value: "bag" },
                        { label: "سطل", value: "bucket" },
                        { label: "بسته", value: "pack" },
                        { label: "قوطی", value: "can" },
                        { label: "شاخه", value: "branch" },
                        { label: "عدد", value: "piece" },
                        { label: "کارتن", value: "box" },
                        { label: "رول", value: "roll" },
                        { label: "کیلوگرم", value: "kg" },
                        { label: "لیتر", value: "liter" },
                      ],
                    },
                    {
                      name: "secondary_unit",
                      type: "select",
                      required: false,
                      label: "واحد فرعی (اختیاری)",
                      admin: {
                        width: "50%",
                        description:
                          "واحد فرعی محتوا یا وزن (مثال: کیلوگرم برای کیسه چسب).",
                      },
                      options: [
                        { label: "متر", value: "meter" },
                        { label: "کیلوگرم", value: "kg" },
                        { label: "سانتی‌متر", value: "cm" },
                        { label: "گرم", value: "g" },
                      ],
                    },
                  ],
                },
                {
                  type: "row",
                  fields: [
                    {
                      name: "weight",
                      type: "number",
                      label: "وزن یا مقدار هر واحد (اختیاری)",
                      admin: {
                        width: "50%",
                        description: "مثال: ۲۵ برای کیسه ۲۵ کیلو",
                      },
                    },
                    {
                      name: "itemsPerPack",
                      type: "number",
                      label: "تعداد در بسته (اختیاری)",
                      admin: {
                        width: "50%",
                        description: "مثال: ۱۰۰ عدد",
                      },
                    },
                  ],
                },
                {
                  type: "row",
                  fields: [
                    {
                      name: "approxCoverage",
                      type: "text",
                      label: "پوشش تقریبی (اختیاری)",
                      admin: {
                        width: "50%",
                        description: "مثال: ۴ الی ۵ مترمربع",
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: "تصاویر و محتوا",
          fields: [
            {
              name: "cover",
              type: "upload",
              relationTo: "media",
              label: "تصویر شاخص",
              admin: {
                description: "تصویر اصلی و کاور محصول در کاتالوگ فروشگاه.",
              },
            },
            {
              name: "gallery",
              type: "array",
              label: "گالری تصاویر",
              labels: {
                singular: "تصویر",
                plural: "تصاویر",
              },
              admin: {
                description: "تصاویر تکمیلی و محیطی محصول.",
              },
              fields: [
                {
                  name: "image",
                  type: "upload",
                  relationTo: "media",
                  required: true,
                  label: "تصویر گالری",
                },
              ],
            },
            {
              name: "richDescription",
              type: "richText",
              label: "توضیحات تکمیلی",
              admin: {
                description:
                  "مشخصات فنی، ویژگی‌های لعاب و راهنمای نصب و نگهداری.",
              },
            },
          ],
        },
      ],
    },
  ],
};
