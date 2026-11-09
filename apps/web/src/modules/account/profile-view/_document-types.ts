export const DOCUMENT_TYPE_OPTIONS = [
  { value: "business_license", label: "پروانه کسب" },
  { value: "establishment_license", label: "جواز تأسیس" },
  { value: "operating_license", label: "پروانه بهره‌برداری" },
  { value: "trade_guild_registration", label: "گواهی ثبت‌نام در نظام صنفی" },
  { value: "union_membership", label: "گواهی عضویت در اتحادیه صنفی" },
  {
    value: "competent_authorities_permit",
    label: "مجوز فعالیت از مراجع ذیصلاح",
  },
  {
    value: "stewardship_card_or_letter",
    label: "کارت مباشرت یا معرفی‌نامه نماینده کسب‌وکار",
  },
  {
    value: "sales_agency_certificate",
    label: "گواهی نمایندگی فروش یا عاملیت رسمی",
  },
  { value: "brand_agency_certificate", label: "گواهی نمایندگی برند" },
  {
    value: "standard_certificate",
    label: "گواهی استاندارد یا مجوز تخصصی، در صورت نیاز",
  },
  { value: "other", label: "غیره" },
] as const;

export type DocumentTypeValue = (typeof DOCUMENT_TYPE_OPTIONS)[number]["value"];

export function getDocumentTypeLabel(type?: string): string {
  const match = DOCUMENT_TYPE_OPTIONS.find((opt) => opt.value === type);
  return match ? match.label : type || "مدرک بارگذاری شده";
}

export interface CustomerDocument {
  id?: string;
  documentType?: string;
  title?: string;
  file?:
    | {
        id: number;
        url?: string;
        filename?: string;
        mimeType?: string;
      }
    | number
    | string;
  status?: "pending" | "approved" | "rejected";
  rejectionReason?: string | null;
  uploadedAt?: string;
}

export function getDocFileUrl(file: any): string | null {
  if (!file) return null;
  if (typeof file === "object" && file.url) {
    return file.url;
  }
  if (typeof file === "string") {
    return file.startsWith("http") || file.startsWith("/")
      ? file
      : `/api/media/file/${file}`;
  }
  return null;
}
