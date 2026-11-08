import type { CollectionConfig } from "payload";
import { syncSlugAndDimensions } from "./_sync-slug-and-dimensions.before-validate";
import { getAdminUser, isCatalogManager } from "../../access/roles";
import { logAction } from "../audit-logs/log-action";
import {
  canUpdateOperationalPrice,
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
    {
      name: "isActive",
      type: "checkbox",
      defaultValue: true,
      label: "نمایش در فروشگاه",
      admin: { position: "sidebar", description: "محصول فعال در کاتالوگ فروشگاه نمایش داده می‌شود." },
    },
    {
      type: "row",
      fields: [
        { name: "name", type: "text", required: true, label: "نام کالا", admin: { width: "45%" } },
        { name: "sku", type: "text", required: true, unique: true, label: "کد کالا (SKU)", admin: { width: "30%" } },
        {
          name: "productType", type: "select", defaultValue: "tile", label: "نوع محصول",
          admin: { width: "25%", description: "تغییر نوع کالای دارای رکورد انبار مجاز نیست." },
          options: [
            { label: "کاشی و سرامیک", value: "tile" },
            { label: "سایر اقلام (چسب و ملزومات)", value: "other" },
          ],
        },
      ],
    },
    {
      type: "tabs",
      tabs: [
        {
          label: "مشخصات کالا",
          fields: [
            {
              type: "row",
              fields: [
                { name: "category", type: "relationship", relationTo: "categories", label: "دسته‌بندی", admin: { width: "50%" } },
                { name: "brand", type: "relationship", relationTo: "brands", label: "برند / کارخانه", admin: { width: "50%" } },
              ],
            },
            {
              type: "row",
              fields: [
                { name: "color", type: "text", label: "رنگ غالب", admin: { width: "50%", description: "مثلاً سفید، طوسی یا کرم." } },
                {
                  name: "grade", type: "select", label: "درجه کیفی", admin: { width: "50%" },
                  options: [
                    { label: "درجه ۱", value: "grade_1" }, { label: "درجه ۲", value: "grade_2" },
                    { label: "درجه ۳", value: "grade_3" }, { label: "درجه ۴", value: "grade_4" },
                  ],
                },
              ],
            },
            {
              name: "dimension", type: "relationship", relationTo: "dimensions", label: "سایز / ابعاد",
              admin: { condition: (data) => !data?.productType || data?.productType === "tile" },
            },
            { name: "width", type: "number", label: "عرض (cm)", admin: { hidden: true, readOnly: true } },
            { name: "height", type: "number", label: "طول (cm)", admin: { hidden: true, readOnly: true } },
            { name: "tags", type: "relationship", relationTo: "tags", hasMany: true, label: "برچسب‌ها" },
          ],
        },
        {
          label: "فروش و بسته‌بندی",
          fields: [
            {
              name: "basePricePerSqm", type: "number", defaultValue: 0, label: "قیمت پایه (تومان)",
              admin: { description: "برای کاشی قیمت هر مترمربع و برای سایر اقلام قیمت هر واحد فروش را وارد کنید." },
              access: { update: canUpdateOperationalPrice, create: canUpdateOperationalPrice },
            },
            {
              type: "row",
              admin: { condition: (data) => !data?.productType || data?.productType === "tile" },
              fields: [
                {
                  name: "sqmPerCarton", type: "number", defaultValue: 1.44, label: "متراژ هر کارتن (مترمربع)",
                  admin: { width: "50%", description: "مقدار پیش‌فرض را با بسته‌بندی کالا تطبیق دهید. تغییر آن در صورت وجود سفارش باز مجاز نیست." },
                },
                {
                  name: "piecesPerCarton", type: "number", defaultValue: 4, label: "تعداد قطعه در هر کارتن",
                  admin: { width: "50%", description: "مقدار پیش‌فرض را بررسی کنید. تغییر آن در صورت وجود سفارش باز مجاز نیست." },
                },
              ],
            },
            {
              name: 'cartonsPerPallet', type: 'number', label: 'تعداد کارتن در هر پالت', min: 1,
              admin: { condition: (data) => !data?.productType || data?.productType === 'tile' },
              access: { create: canUpdateOperationalPrice, update: canUpdateOperationalPrice },
              validate: (value: number | null | undefined) => value == null || (Number.isSafeInteger(value) && value > 0) || 'تعداد کارتن پالت باید عدد صحیح مثبت باشد.',
            },
            {
              name: "unit", type: "select", defaultValue: "bag", label: "واحد فروش",
              admin: { condition: (data) => data?.productType === "other", description: "تغییر واحد کالای دارای رکورد انبار مجاز نیست." },
              options: [
                { label: "کیسه", value: "bag" }, { label: "سطل", value: "bucket" },
                { label: "بسته", value: "pack" }, { label: "قوطی", value: "can" },
                { label: "شاخه", value: "branch" }, { label: "عدد", value: "piece" },
                { label: "کارتن", value: "box" }, { label: "رول", value: "roll" },
                { label: "کیلوگرم", value: "kg" }, { label: "لیتر", value: "liter" },
              ],
            },
            {
              type: "collapsible", label: "جزئیات بسته‌بندی و پوشش",
              admin: { initCollapsed: true, condition: (data) => data?.productType === "other" },
              fields: [
                {
                  type: "row",
                  fields: [
                    {
                      name: "weight", type: "number", label: "مقدار محتوا در هر واحد",
                      admin: { width: "50%", description: "مثلاً ۲۵ برای کیسه ۲۵ کیلوگرمی." },
                    },
                    {
                      name: "secondary_unit", type: "select", label: "واحد محتوا", admin: { width: "50%" },
                      options: [
                        { label: "متر", value: "meter" }, { label: "کیلوگرم", value: "kg" },
                        { label: "سانتی‌متر", value: "cm" }, { label: "گرم", value: "g" },
                      ],
                    },
                  ],
                },
                {
                  type: "row",
                  fields: [
                    { name: "itemsPerPack", type: "number", label: "تعداد در بسته", admin: { width: "50%", description: "مثلاً ۱۰۰ عدد." } },
                    { name: "approxCoverage", type: "text", label: "پوشش تقریبی", admin: { width: "50%", description: "مثلاً ۴ تا ۵ مترمربع." } },
                  ],
                },
              ],
            },
            {
              name: "inventorySqm", type: "number", defaultValue: 0, label: "موجودی",
              admin: { hidden: true }, access: { update: () => false, create: () => false },
            },
            { name: "stockCartons", type: "number", defaultValue: 0, label: "تعداد کارتن", admin: { hidden: true, readOnly: true } },
            { name: "productPreviewUi", type: "ui", admin: { components: { Field: "/collections/products/components/ProductPreview#ProductPreview" } } },
          ],
        },
        {
          label: "محتوای فروشگاه",
          fields: [
            { name: "cover", type: "upload", relationTo: "media", label: "تصویر شاخص", admin: { description: "تصویر اصلی محصول در فروشگاه." } },
            {
              name: "gallery", type: "array", label: "گالری تصاویر", labels: { singular: "تصویر", plural: "تصاویر" },
              fields: [{ name: "image", type: "upload", relationTo: "media", required: true, label: "تصویر گالری" }],
            },
            { name: "richDescription", type: "richText", label: "توضیحات تکمیلی", admin: { description: "ویژگی‌ها و راهنمای نصب و نگهداری." } },
          ],
        },
        {
          label: "پیشرفته",
          fields: [
            {
              name: "slug", type: "text", required: true, unique: true, label: "شناسه نشانی محصول",
              admin: { description: "هنگام ایجاد از کد کالا ساخته می‌شود؛ تغییر آن نشانی محصول را تغییر می‌دهد." },
            },
            {
              name: "scanCode", type: "text", unique: true, maxLength: 128,
              access: { read: ({ req }) => Boolean(getAdminUser(req.user)) },
              label: "کد شناسایی اسکن",
              admin: { description: "کد یکتای محصول برای ساخت QR و شناسایی هنگام اسکن." },
              hooks: { beforeValidate: [({ value }) => typeof value === "string" ? value.trim().toUpperCase() || null : value] },
              validate: (value: string | null | undefined) => !value || (value.length <= 128 && /^[A-Z0-9-]+$/.test(value)) || "حداکثر ۱۲۸ حرف لاتین، رقم یا خط تیره مجاز است.",
            },
          ],
        },
      ],
    },
  ],
};
