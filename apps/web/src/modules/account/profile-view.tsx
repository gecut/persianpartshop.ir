import { PwaAccountButton } from '@/modules/pwa/pwa-account-button'
import { DataStatus } from '@/components/feedback/data-status'
import { useTextDraft } from '@/lib/drafts'
import { useWriteActivity, writeActivity } from '@/lib/write-activity'
import { useState, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Modal as HeroUIModal,
  Drawer,
  Button,
  TextField,
  Label,
  Input,
  Select,
  ListBox,
} from "@heroui/react";
import { useAuth } from "@/modules/auth/auth-store";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { toPersianDigits } from "@/lib/utils/currency";
import { formatPersianDate } from "@/lib/utils/date";
import { toast } from "@/components/feedback/toast";
import {
  UserIcon,
  StoreIcon,
  PhoneIcon,
  LogOutIcon,
  AlertCircleIcon,
  PencilIcon,
  CheckIcon,
  XIcon,
  LockIcon,
  FileTextIcon,
  PlusIcon,
  Trash2Icon,
  CheckCircle2Icon,
  ClockIcon,
  RefreshCwIcon,
  ZoomInIcon,
} from "@/components/ui/icons";

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

interface CustomerDocument {
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

function getDocFileUrl(file: any): string | null {
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

async function compressImageFile(file: File, maxDimension = 1920, quality = 0.82): Promise<File> {
  if (typeof window === "undefined" || !file.type.startsWith("image/") || file.type.includes("svg")) {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;

      if (width <= maxDimension && height <= maxDimension && file.size < 800 * 1024) {
        return resolve(file);
      }

      if (width > height) {
        if (width > maxDimension) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        }
      } else {
        if (height > maxDimension) {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(file);

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) return resolve(file);
          const newName = file.name.replace(/\.[^/.]+$/, ".webp");
          const compressedFile = new File([blob], newName, { type: "image/webp" });
          resolve(compressedFile);
        },
        "image/webp",
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

export function ProfileView() {
  const pendingWrites = useWriteActivity();
  const navigate = useNavigate();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, logout, updateProfile } = useAuth();
  const queryClient = useQueryClient();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Profile Query from API to get documents and real-time status
  const {
    data: profileDoc,
    isLoading: isProfileLoading,
    error: profileError,
    isFetching: isProfileFetching,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: queryKeys.auth.profile(user?.id),
    queryFn: ({ signal }) => api.user.profile(undefined, { signal }),
    staleTime: 120_000,
    enabled: !!user,
  });

  const documents =
    ((profileDoc as any)?.documents as CustomerDocument[]) || [];

  // State for uploading new document
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadDocType, setUploadDocType] =
    useState<DocumentTypeValue>("business_license");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeletingDocId, setIsDeletingDocId] = useState<string | null>(null);

  // State for previewing full-size document
  const [previewDoc, setPreviewDoc] = useState<CustomerDocument | null>(null);

  const [formData, setFormData, discardProfileDraft] = useTextDraft(user?.id ?? '', 'profile', {
    name: user?.name || "",
    storeName: user?.storeName || "",
    address: user?.address || "",
  });

  if (!user) {
    return (
      <div className="bg-muted/5 rounded-2xl p-8 text-center max-w-md mx-auto my-12">
        <AlertCircleIcon size={36} className="text-muted mx-auto mb-3" />
        <h3 className="text-base font-bold text-foreground">
          حساب کاربری یافت نشد
        </h3>
        <p className="text-xs text-muted mt-1 mb-5">
          جهت مشاهده حساب کاربری لطفاً وارد سامانه شوید.
        </p>
        <Button
          type="button"
          onPress={() => navigate({ to: "/login" })}
          className="w-full h-10 px-4 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs cursor-pointer"
        >
          ورود به حساب کاربری
        </Button>
      </div>
    );
  }

  const handleStartEdit = () => { setIsEditing(true); };

  const handleCancelEdit = () => {
    setFormData({
      name: user.name,
      storeName: user.storeName,
      address: user.address || "",
    });
    discardProfileDraft();
    setIsEditing(false);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pendingWrites > 0) return;

    if (!formData.name.trim()) {
      toast.warning("نام و نام خانوادگی الزامی است.");
      return;
    }

    if (!formData.storeName.trim()) {
      toast.warning("عنوان فروشگاه یا شرکت الزامی است.");
      return;
    }

    try {
      await updateProfile({
        name: formData.name.trim(),
        storeName: formData.storeName.trim(),
        address: formData.address.trim(),
      });
      toast.success('تغییرات ذخیره شد', 'اطلاعات حساب کاربری با موفقیت به‌روزرسانی گردید.');
      discardProfileDraft();
      setIsEditing(false);
    } catch (error) {
      toast.error('تغییرات ذخیره نشد', error instanceof Error ? error.message : 'دوباره تلاش کنید.');
    }
  };

  const handleLogout = () => {
    setShowLogoutConfirm(false);
    if (!logout()) return;
    toast.info("خروج از حساب", "از حساب کاربری خود خارج شدید.");
    navigate({ to: "/login" });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      toast.warning("حجم فایل انتخابی بیش از حد مجاز است (حداکثر ۱۵ مگابایت).");
      return;
    }

    setUploadFile(file);
    if (!uploadTitle.trim()) {
      setUploadTitle(file.name.replace(/\.[^/.]+$/, ""));
    }

    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setUploadPreviewUrl(url);
    } else {
      setUploadPreviewUrl(null);
    }
  };

  const handleCloseUploadModal = () => {
    setShowUploadModal(false);
    setUploadFile(null);
    setUploadDocType("business_license");
    setUploadTitle("");
    if (uploadPreviewUrl) {
      URL.revokeObjectURL(uploadPreviewUrl);
      setUploadPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      toast.warning("لطفاً ابتدا فایل مدرک را انتخاب فرمایید.");
      return;
    }

    const finishUpload = writeActivity.begin();
    setIsUploading(true);
    try {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("persianpart_token")
          : null;
      const fileToUpload = await compressImageFile(uploadFile);
      const formDataUpload = new FormData();
      formDataUpload.append("file", fileToUpload);
      formDataUpload.append(
        "alt",
        uploadTitle.trim() ||
          getDocumentTypeLabel(uploadDocType) ||
          "مدرک مشتری",
      );

      const apiBase = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
      const uploadRes = await fetch(`${apiBase}/api/media/upload`, {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formDataUpload,
        signal: AbortSignal.timeout(30_000),
      });

      if (!uploadRes.ok) {
        if (uploadRes.status === 413) {
          throw new Error("حجم فایل انتخابی بیش از سقف مجاز وب‌سرور است (خطای ۴۱۳).");
        }
        const errJson = await uploadRes.json().catch(() => null);
        throw new Error(errJson?.error || "خطا در بارگذاری فایل در سرور");
      }

      if (token !== localStorage.getItem('persianpart_token')) throw new Error('حساب کاربری تغییر کرده است.');
      const uploadData = await uploadRes.json();
      const mediaId = uploadData.id;

      const currentDocs = documents;
      const updatedDocs = [
        ...currentDocs.map((d) => ({
          id: d.id,
          documentType: d.documentType,
          title: d.title,
          file:
            typeof d.file === "object" && d.file ? (d.file as any).id : d.file,
          status: d.status,
          rejectionReason: d.rejectionReason,
          uploadedAt: d.uploadedAt,
        })),
        {
          documentType: uploadDocType,
          title: uploadTitle.trim() || getDocumentTypeLabel(uploadDocType),
          file: mediaId,
          status: "pending" as const,
          uploadedAt: new Date().toISOString(),
        },
      ];

      const profile = await api.user.update({ documents: updatedDocs });
      queryClient.setQueryData(queryKeys.auth.profile(user?.id), profile);

      toast.success(
        "مدرک با موفقیت بارگذاری شد",
        "مدرک شما ثبت شد و در انتظار بررسی و تأیید مدیریت قرار گرفت.",
      );
      handleCloseUploadModal();
    } catch (err: any) {
      toast.error(
        "خطا در بارگذاری مدرک",
        err.message || "لطفاً مجدداً تلاش فرمایید.",
      );
    } finally {
      finishUpload();
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async (docId?: string) => {
    if (!docId) return;
    const target = documents.find((d) => String(d.id) === String(docId));
    if (target?.status === "approved") {
      toast.error("امکان حذف مدرک تأیید شده وجود ندارد.");
      return;
    }

    setIsDeletingDocId(docId);
    try {
      const remaining = documents
        .filter((d) => String(d.id) !== String(docId))
        .map((d) => ({
          id: d.id,
          documentType: d.documentType,
          title: d.title,
          file:
            typeof d.file === "object" && d.file ? (d.file as any).id : d.file,
          status: d.status,
          rejectionReason: d.rejectionReason,
          uploadedAt: d.uploadedAt,
        }));

      const profile = await api.user.update({ documents: remaining });
      queryClient.setQueryData(queryKeys.auth.profile(user?.id), profile);

      toast.success("مدرک حذف شد", "فایل مورد نظر از لیست مدارک حذف گردید.");
    } catch (err: any) {
      toast.error(
        "خطا در حذف مدرک",
        err.message || "امکان حذف این مدرک وجود ندارد.",
      );
    } finally {
      setIsDeletingDocId(null);
    }
  };

  return (
    <div className="space-y-3.5 w-full">
      <PwaAccountButton />
      <DataStatus error={profileError} hasData={!!profileDoc} fetching={isProfileFetching} onRetry={() => void refetchProfile()} />
      {/* Top Header Card */}
      <div className="bg-muted/5 rounded-2xl p-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-base font-bold text-foreground">
                {user.name}
              </h2>
            </div>
            <p className="text-xs text-muted mt-0.5 flex items-center gap-1">
              <StoreIcon size={12} className="text-muted shrink-0" />
              <span className="truncate max-w-50">{user.storeName}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            onPress={() => setShowLogoutConfirm(true)}
            className="h-10 px-4 rounded-2xl bg-danger/15 text-danger hover:bg-danger/20 text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95"
            aria-label="خروج از حساب"
          >
            <LogOutIcon size={14} />
            <span>خروج</span>
          </Button>
        </div>
      </div>

      {/* Main View Cards */}
      <div className="space-y-2.5">
        <div className="bg-muted/5 rounded-2xl p-3.5 sm:p-4 flex items-start gap-3">
          <UserIcon size={17} className="text-muted mt-0.5 shrink-0" />
          <div className="flex-1 text-start">
            <span className="text-xs font-semibold text-muted block">
              نام نماینده / مدیر خرید
            </span>
            <span className="text-xs sm:text-sm font-bold text-foreground">
              {user.name}
            </span>
          </div>
        </div>

        <div className="bg-muted/5 rounded-2xl p-3.5 sm:p-4 flex items-start gap-3">
          <StoreIcon size={17} className="text-muted mt-0.5 shrink-0" />
          <div className="flex-1 text-start">
            <span className="text-xs font-semibold text-muted block">
              عنوان فروشگاه / شرکت حقوقی
            </span>
            <span className="text-xs sm:text-sm font-bold text-foreground">
              {user.storeName}
            </span>
          </div>
        </div>

        <div className="bg-muted/5 rounded-2xl p-3.5 sm:p-4 flex items-start justify-start gap-3">
          <PhoneIcon size={17} className="text-muted mt-0.5 shrink-0" />
          <div className="flex-1 text-start">
            <div className="flex items-start justify-start">
              <span className="text-xs font-semibold text-muted block">
                شماره تلفن همراه
              </span>
            </div>
            <span
              className="text-xs sm:text-sm text-right font-bold text-foreground tracking-wider mt-0.5 block"
              dir="ltr"
            >
              {toPersianDigits(user.phone)}
            </span>
          </div>
        </div>

        {/* Quick Edit CTA Button */}
        <div className="pt-1">
          <Button
            type="button"
            onPress={handleStartEdit}
            className="h-12 w-full px-4 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
          >
            <PencilIcon size={16} />
            <span>ویرایش اطلاعات</span>
          </Button>
        </div>
      </div>

      {/* Document Upload Section ("آپلود مدارک") */}
      <div className="bg-muted/5 rounded-2xl p-3.5 sm:p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 border-b border-border/10 pb-3">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <FileTextIcon size={16} />
            </div>
            <div className="text-start">
              <h3 className="text-xs sm:text-sm font-bold text-foreground">
                آپلود مدارک
              </h3>
              {/* <p className="text-[11px] text-muted">
                بارگذاری مدارک هویتی و پروانه کسب جهت تأیید حساب
              </p> */}
            </div>
          </div>

          <Button
            type="button"
            onPress={() => setShowUploadModal(true)}
            className="h-8 px-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95"
          >
            <PlusIcon size={14} />
            <span>بارگذاری مدرک</span>
          </Button>
        </div>

        {/* Loading state */}
        {isProfileLoading ? (
          <div className="py-6 flex items-center justify-center gap-2 text-muted text-xs">
            <RefreshCwIcon size={16} className="animate-spin" />
            <span>در حال بارگذاری مدارک...</span>
          </div>
        ) : documents.length === 0 ? (
          /* Empty state */
          <div className="text-center py-6 px-4 bg-muted/5 rounded-xl border border-dashed border-border/40">
            <FileTextIcon size={32} className="text-muted/50 mx-auto mb-2" />
            <p className="text-xs font-bold text-foreground">
              هنوز مدرکی بارگذاری نشده است
            </p>
            <p className="text-[11px] text-muted mt-1 max-w-xs mx-auto leading-relaxed">
              جهت فعال‌سازی اعتبارسنجی و پیش‌فاکتور رسمی، مدارک شناسایی یا
              پروانه کسب خود را ارسال نمایید.
            </p>
            <Button
              type="button"
              onPress={() => setShowUploadModal(true)}
              className="mt-3 h-8 px-3.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 font-bold text-xs cursor-pointer inline-flex items-center gap-1"
            >
              <PlusIcon size={14} />
              <span>بارگذاری اولین مدرک</span>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((doc, idx) => {
              const fileUrl = getDocFileUrl(doc.file);
              const isApproved = doc.status === "approved";
              const isRejected = doc.status === "rejected";
              const isPending = !doc.status || doc.status === "pending";

              return (
                <div
                  key={doc.id || idx}
                  className="bg-background/80 border border-border/15 rounded-xl p-3 flex flex-col gap-2 transition-all"
                >
                  <div className="flex items-center gap-3">
                    {/* Thumbnail */}

                    {fileUrl ? (
                      <button
                        type="button"
                        onClick={() => setPreviewDoc(doc)}
                        className="relative size-14 rounded-xl overflow-hidden bg-muted/10 shrink-0 cursor-pointer border border-border/20 group"
                        title="مشاهده تصویر در اندازه واقعی"
                      >
                        <img
                          src={fileUrl}
                          alt={doc.title || "مدرک"}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                          <ZoomInIcon size={16} />
                        </div>
                      </button>
                    ) : (
                      <div className="size-14 rounded-xl bg-muted/10 shrink-0 flex items-center justify-center border border-border/20 text-muted">
                        <FileTextIcon size={22} />
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0 text-start">
                      {/* Subtitle if custom title differs */}
                      <div className="flex w-full items-center justify-between gap-1">
                        <h4 className="text-xs sm:text-sm font-bold text-foreground truncate">
                          {getDocumentTypeLabel(doc.documentType) ||
                            doc.title ||
                            "مدرک بارگذاری شده"}
                        </h4>

                        {/* Status Badge */}
                      </div>

                      {doc.title &&
                        doc.title !==
                          getDocumentTypeLabel(doc.documentType) && (
                          <p className="text-[11px] text-muted truncate mt-0.5">
                            {doc.title}
                          </p>
                        )}

                      {/* Date & Lock status */}
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-muted">
                        <span>{formatPersianDate(doc.uploadedAt)}</span>
                        {isApproved && (
                          <span className="shrink-0   px-2 py-0.5 rounded-full text-[11px] font-bold bg-success/15 text-success flex items-center gap-1">
                            <CheckCircle2Icon size={12} />
                            <span>تایید شده</span>
                          </span>
                        )}
                        {isRejected && (
                          <span className="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold bg-danger/15 text-danger flex items-center gap-1">
                            <AlertCircleIcon size={12} />
                            <span>لغو شده</span>
                          </span>
                        )}
                        {isPending && (
                          <span className="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold bg-warning/15 text-warning flex items-center gap-1">
                            <ClockIcon size={12} />
                            <span>منتظر تایید ادمین</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action: strictly locked if approved, deletable if pending or rejected */}
                    <div className="shrink-0">
                      {isApproved ? (
                        <div
                          className="size-8 rounded-xl bg-success/10 text-success flex items-center justify-center cursor-not-allowed"
                          title="مدرک تأیید شده قفل است و امکان تغییر یا حذف آن وجود ندارد."
                        >
                          <LockIcon size={14} />
                        </div>
                      ) : (
                        <Button
                          type="button"
                          onPress={() => handleDeleteDocument(doc.id)}
                          isDisabled={isDeletingDocId === doc.id}
                          className="size-8 rounded-xl bg-danger/10 text-danger hover:bg-danger/20 flex items-center justify-center cursor-pointer transition-all active:scale-95"
                          aria-label="حذف مدرک"
                        >
                          {isDeletingDocId === doc.id ? (
                            <RefreshCwIcon size={13} className="animate-spin" />
                          ) : (
                            <Trash2Icon size={14} />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Rejection notice */}
                  {isRejected && doc.rejectionReason && (
                    <div className="p-2 rounded-lg bg-danger/10 text-danger text-[11px] flex items-start gap-1.5 leading-relaxed text-start">
                      <AlertCircleIcon size={13} className="shrink-0 mt-0.5" />
                      <span>
                        <strong>علت عدم تأیید:</strong> {doc.rejectionReason}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Drawer>
        <Drawer.Backdrop
          isOpen={isEditing}
          onOpenChange={(open) => !open && handleCancelEdit()}
          className="fixed z-50 backdrop-blur-xs bg-foreground/30 min-h-60 flex items-end justify-center fade-up transition-all duration-300"
        >
          <Drawer.Content
            placement="bottom"
            className="w-full max-w-lg mx-auto fixed z-50 bottom-0! mb-0! inset-x-0 top-auto h-auto! max-h-[92dvh] rounded-t-3xl rounded-b-none! flex flex-col overflow-hidden border-b-0!"
          >
            <Drawer.Dialog className="flex flex-col bg-background h-auto! max-h-[92dvh] min-h-0 outline-none text-start overscroll-contain m-0! mb-0! p-0! rounded-b-none!">
              {/* Drag Handle UI */}
              <div className="flex justify-center w-full shrink-0 pt-2 pb-1">
                <Drawer.Handle className="w-16 h-1.5 rounded-full" />
              </div>

              {/* Header */}
              <Drawer.Header className="w-full flex flex-row! items-center justify-between px-5 pt-2 pb-2 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <PencilIcon size={16} />
                  </span>
                  <Drawer.Heading className="text-sm font-extrabold text-foreground">
                    ویرایش اطلاعات حساب کاربری
                  </Drawer.Heading>
                </div>

                <Button
                  type="button"
                  onClick={handleCancelEdit}
                  aria-label="بستن"
                  className="size-10 rounded-2xl bg-muted/10 hover:bg-muted/20 text-muted hover:text-foreground flex items-center justify-center cursor-pointer transition-colors shrink-0"
                >
                  <XIcon />
                </Button>
              </Drawer.Header>

              {/* Form & Body */}
              <form
                onSubmit={handleSaveProfile}
                className="flex flex-col flex-1 min-h-0"
              >
                <Drawer.Body className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-3 space-y-4 scrollbar-none">
                  {/* Name Field */}
                  <TextField
                    name="name"
                    isRequired
                    className="space-y-1 text-start"
                  >
                    <Label className="text-sm font-semibold text-foreground flex items-center gap-1">
                      <UserIcon size={15} className="text-muted" />
                      <span>نام و نام خانوادگی</span>
                    </Label>
                    <Input
                      value={formData.name}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      style={{ fontSize: "12px" }}
                      className="w-full p-4 text-xs! placeholder:text-xs! font-bold text-foreground bg-muted/10 rounded-2xl outline-none transition-all"
                      placeholder="مثال: آرش دهقان"
                    />
                  </TextField>

                  {/* Store Name Field */}
                  <TextField
                    name="storeName"
                    isRequired
                    className="space-y-1 text-start"
                  >
                    <Label className="text-sm font-semibold text-foreground flex items-center gap-1">
                      <StoreIcon size={15} className="text-muted" />
                      <span>نام فروشگاه / شرکت</span>
                    </Label>
                    <Input
                      value={formData.storeName}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          storeName: e.target.value,
                        }))
                      }
                      className="w-full p-4 text-xs! placeholder:text-xs! font-bold text-foreground bg-muted/10 rounded-2xl outline-none transition-all"
                      placeholder="مثال: بازرگانی پرشین پارت"
                    />
                  </TextField>

                  {/* Phone Number - Strictly Non-Editable */}
                  <div className="space-y-1 text-start cursor-no-drop">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold text-foreground flex items-center gap-1">
                        <PhoneIcon size={15} className="text-muted" />
                        <span>شماره همراه</span>
                      </label>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-muted/10 rounded-2xl text-foreground select-none">
                      <span
                        className="text-xs! font-bold tracking-wider"
                        dir="ltr"
                      >
                        {toPersianDigits(user.phone)}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-medium text-muted w-fit rounded-lg">
                        <LockIcon size={16} className="text-muted" />
                      </span>
                    </div>
                  </div>
                </Drawer.Body>

                {/* Footer Actions */}
                <Drawer.Footer className="px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] shrink-0 flex items-center gap-2 border-t border-border/20 bg-background">
                  <Button
                    type="button"
                    onClick={handleCancelEdit}
                    className="h-12 px-4 rounded-2xl bg-muted/10 hover:bg-muted/15 text-foreground font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <XIcon size={15} />
                    <span>انصراف</span>
                  </Button>
                  <Button
                    type="submit" isDisabled={pendingWrites > 0}
                    className="flex-1 h-12 px-4 rounded-2xl bg-success/15 text-success hover:bg-success/20 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98"
                  >
                    <CheckIcon size={15} />
                    <span>ذخیره تغییرات</span>
                  </Button>
                </Drawer.Footer>
              </form>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>

      {/* Upload Document Modal */}
      <HeroUIModal.Root
        isOpen={showUploadModal}
        onOpenChange={(open) => !open && handleCloseUploadModal()}
      >
        <HeroUIModal.Backdrop
          isDismissable
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-backdrop-enter"
        >
          <HeroUIModal.Container className="pointer-events-none w-full max-w-md h-auto p-0 flex flex-col items-center">
            <HeroUIModal.Dialog className="pointer-events-auto relative w-full bg-surface rounded-2xl flex flex-col z-10 overflow-hidden animate-modal-enter text-start p-5 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-border/10 pb-3">
                <div className="flex items-center gap-2">
                  <span className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <FileTextIcon size={16} />
                  </span>
                  <HeroUIModal.Heading className="text-sm font-extrabold text-foreground">
                    آپلود مدارک
                  </HeroUIModal.Heading>
                </div>
                <Button
                  type="button"
                  onPress={handleCloseUploadModal}
                  className="size-8 rounded-xl bg-muted/10 hover:bg-muted/20 text-muted hover:text-foreground flex items-center justify-center cursor-pointer transition-colors"
                >
                  <XIcon size={16} />
                </Button>
              </div>

              <form onSubmit={handleUploadDocument} className="space-y-4">
                {/* Document Type Selection (HeroUI Select Input) */}
                <div className="space-y-1.5 text-start">
                  <Select
                    selectedKey={uploadDocType}
                    onSelectionChange={(key) => {
                      if (key)
                        setUploadDocType(String(key) as DocumentTypeValue);
                    }}
                    fullWidth
                    className="w-full text-start"
                    aria-label="نوع مدرک"
                  >
                    <Label className="text-xs font-semibold text-foreground flex items-center justify-between mb-1">
                      <span>نوع مدرک</span>
                      <span className="text-danger text-[11px] font-bold">
                        الزامی
                      </span>
                    </Label>
                    <Select.Trigger className="w-full h-11 px-3.5 rounded-xl bg-muted/10 border border-border/20 text-foreground font-bold text-xs flex items-center justify-between cursor-pointer hover:bg-muted/15 transition-colors">
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover
                      dir="rtl"
                      className="w-[var(--trigger-width)] max-h-60 overflow-y-auto rounded-xl bg-surface border border-border/20 p-1.5 shadow-2xl z-60"
                    >
                      <ListBox dir="rtl">
                        {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                          <ListBox.Item
                            key={opt.value}
                            id={opt.value}
                            textValue={opt.label}
                            className="px-3 py-2 text-xs font-bold rounded-lg cursor-pointer hover:bg-muted/15 flex items-center justify-between text-right"
                          >
                            <span>{opt.label}</span>
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>

                {/* Optional Custom Description */}
                <TextField
                  name="documentTitle"
                  className="space-y-1 text-start"
                >
                  <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
                    <span>توضیحات تکمیلی مدرک</span>
                    <span className="text-muted font-normal">(اختیاری)</span>
                  </Label>
                  <Input
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="مثال: پروانه کسب شعبه دوم، استعلام سال جاری و..."
                    className="w-full p-3 text-xs font-bold text-foreground bg-muted/10 rounded-xl outline-none"
                  />
                </TextField>

                {/* File Upload Box */}
                <div className="space-y-1.5 text-start">
                  <label className="text-xs font-semibold text-foreground block">
                    انتخاب فایل تصویر یا PDF
                  </label>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    id="doc-file-input"
                  />

                  {uploadPreviewUrl ? (
                    <div className="relative rounded-xl overflow-hidden border border-border/20 bg-muted/5 p-2 flex items-center gap-3">
                      <img
                        src={uploadPreviewUrl}
                        alt="پیش‌نمایش"
                        className="size-16 object-cover rounded-lg shrink-0 border border-border/20"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">
                          {uploadFile?.name}
                        </p>
                        <p className="text-[11px] text-muted mt-0.5">
                          {((uploadFile?.size || 0) / (1024 * 1024)).toFixed(2)}{" "}
                          مگابایت
                        </p>
                      </div>
                      <Button
                        type="button"
                        onPress={() => {
                          setUploadFile(null);
                          if (uploadPreviewUrl) {
                            URL.revokeObjectURL(uploadPreviewUrl);
                            setUploadPreviewUrl(null);
                          }
                          if (fileInputRef.current)
                            fileInputRef.current.value = "";
                        }}
                        className="size-7 rounded-lg bg-danger/10 text-danger hover:bg-danger/20 flex items-center justify-center cursor-pointer"
                      >
                        <XIcon size={14} />
                      </Button>
                    </div>
                  ) : uploadFile ? (
                    <div className="rounded-xl border border-border/20 bg-muted/5 p-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 truncate">
                        <FileTextIcon
                          size={20}
                          className="text-muted shrink-0"
                        />
                        <span className="text-xs font-bold text-foreground truncate">
                          {uploadFile.name}
                        </span>
                      </div>
                      <Button
                        type="button"
                        onPress={() => {
                          setUploadFile(null);
                          if (fileInputRef.current)
                            fileInputRef.current.value = "";
                        }}
                        className="size-7 rounded-lg bg-danger/10 text-danger hover:bg-danger/20 flex items-center justify-center cursor-pointer"
                      >
                        <XIcon size={14} />
                      </Button>
                    </div>
                  ) : (
                    <label
                      htmlFor="doc-file-input"
                      className="border-2 border-dashed border-border/40 hover:border-primary/50 bg-muted/5 hover:bg-muted/10 rounded-xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all"
                    >
                      <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                        <PlusIcon size={20} />
                      </div>
                      <span className="text-xs font-bold text-foreground">
                        برای انتخاب فایل مدرک کلیک کنید
                      </span>
                      <span className="text-[11px] text-muted">
                        فرمت‌های مجاز: JPG, PNG, WEBP, PDF (حداکثر ۱۵ مگابایت)
                      </span>
                    </label>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-border/10">
                  <Button
                    type="button"
                    onPress={handleCloseUploadModal}
                    className="h-11 px-4 rounded-xl bg-muted/10 hover:bg-muted/15 text-foreground font-bold text-xs cursor-pointer flex-1"
                  >
                    انصراف
                  </Button>
                  <Button
                    type="submit"
                    isDisabled={!uploadFile || isUploading || pendingWrites > 0}
                    className="h-11 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs cursor-pointer flex-1 flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isUploading ? (
                      <>
                        <RefreshCwIcon size={14} className="animate-spin" />
                        <span>در حال ارسال...</span>
                      </>
                    ) : (
                      <>
                        <CheckIcon size={15} />
                        <span>ارسال مدرک</span>
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </HeroUIModal.Dialog>
          </HeroUIModal.Container>
        </HeroUIModal.Backdrop>
      </HeroUIModal.Root>

      {/* Full-size Image Preview Modal */}
      <HeroUIModal.Root
        isOpen={!!previewDoc}
        onOpenChange={(open) => !open && setPreviewDoc(null)}
      >
        <HeroUIModal.Backdrop
          isDismissable
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-backdrop-enter"
        >
          <HeroUIModal.Container className="pointer-events-none w-full max-w-lg h-auto p-0 flex flex-col items-center">
            <HeroUIModal.Dialog className="pointer-events-auto relative w-full bg-surface rounded-2xl flex flex-col z-10 overflow-hidden animate-modal-enter text-start p-4 space-y-3 shadow-2xl">
              <div className="flex items-center justify-between border-b border-border/10 pb-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <FileTextIcon size={16} className="text-muted shrink-0" />
                  <HeroUIModal.Heading className="text-xs sm:text-sm font-bold text-foreground truncate">
                    {previewDoc?.title || "مشاهده مدرک"}
                  </HeroUIModal.Heading>
                </div>
                <Button
                  type="button"
                  onPress={() => setPreviewDoc(null)}
                  className="size-8 rounded-xl bg-muted/10 hover:bg-muted/20 text-muted hover:text-foreground flex items-center justify-center cursor-pointer transition-colors"
                >
                  <XIcon size={16} />
                </Button>
              </div>

              {previewDoc && getDocFileUrl(previewDoc.file) && (
                <div className="rounded-xl overflow-hidden bg-black/5 flex items-center justify-center max-h-[70vh]">
                  <img
                    src={getDocFileUrl(previewDoc.file)!}
                    alt={previewDoc.title || "مدرک"}
                    className="max-h-[70vh] w-auto object-contain rounded-xl"
                  />
                </div>
              )}

              <div className="flex items-center justify-between text-[11px] text-muted pt-1">
                <span>
                  تاریخ بارگذاری: {formatPersianDate(previewDoc?.uploadedAt)}
                </span>
                {previewDoc?.status === "approved" && (
                  <span className="text-success font-bold flex items-center gap-1">
                    <CheckCircle2Icon size={12} />
                    <span>تأیید شده و قفل</span>
                  </span>
                )}
              </div>
            </HeroUIModal.Dialog>
          </HeroUIModal.Container>
        </HeroUIModal.Backdrop>
      </HeroUIModal.Root>

      {/* HeroUI Logout Confirmation Modal */}
      <HeroUIModal.Root
        isOpen={showLogoutConfirm}
        onOpenChange={(open) => !open && setShowLogoutConfirm(false)}
      >
        <HeroUIModal.Backdrop
          isDismissable
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-backdrop-enter"
        >
          <HeroUIModal.Container className="pointer-events-none w-full max-w-sm h-auto p-0 flex flex-col items-center">
            <HeroUIModal.Dialog className="pointer-events-auto relative w-full bg-surface rounded-2xl flex flex-col z-10 overflow-hidden animate-modal-enter text-center p-6 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-danger/15 text-danger flex items-center justify-center mx-auto">
                <LogOutIcon size={24} />
              </div>
              <div>
                <HeroUIModal.Heading className="text-base font-bold text-foreground">
                  خروج از حساب کاربری
                </HeroUIModal.Heading>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  با خروج، سبد و تمام پیش‌نویس‌های این حساب در دستگاه حذف می‌شوند. ادامه می‌دهید؟
                </p>
              </div>
              <div className="w-full flex items-center justify-center gap-1.5 pt-2">
                <Button
                  type="button"
                  onPress={() => setShowLogoutConfirm(false)}
                  className="h-12 px-4 w-full rounded-2xl bg-muted/10 text-foreground text-xs font-bold hover:bg-muted/15 cursor-pointer transition-all"
                >
                  انصراف
                </Button>
                <Button
                  type="button"
                  isDisabled={pendingWrites > 0 || isUploading || !!isDeletingDocId}
                  onPress={handleLogout}
                  className="h-12 px-4 w-full rounded-2xl bg-danger/15 text-danger hover:bg-danger/20 font-bold text-xs cursor-pointer transition-all"
                >
                  تأیید خروج
                </Button>
              </div>
            </HeroUIModal.Dialog>
          </HeroUIModal.Container>
        </HeroUIModal.Backdrop>
      </HeroUIModal.Root>
    </div>
  );
}
