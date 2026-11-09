import { writeActivity } from '@/lib/write-activity'
import { useState, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { queryKeys } from "@/lib/query-keys"
import { toast } from "@/components/feedback/toast"
import { compressImageFile } from "./_compress-image"
import { getDocumentTypeLabel, type CustomerDocument, type DocumentTypeValue } from "./_document-types"

interface UseProfileDocumentsOptions {
  documents: CustomerDocument[];
  userId: Parameters<typeof queryKeys.auth.profile>[0];
}

export function useProfileDocuments({ documents, userId }: UseProfileDocumentsOptions) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadDocType, setUploadDocType] =
    useState<DocumentTypeValue>("business_license");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeletingDocId, setIsDeletingDocId] = useState<string | null>(null);

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

  const clearUploadFile = () => {
    setUploadFile(null);
    if (uploadPreviewUrl) {
      URL.revokeObjectURL(uploadPreviewUrl);
      setUploadPreviewUrl(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
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
            typeof d.file === "object" && d.file ? d.file.id : d.file,
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
      queryClient.setQueryData(queryKeys.auth.profile(userId), profile);

      toast.success(
        "مدرک با موفقیت بارگذاری شد",
        "مدرک شما ثبت شد و در انتظار بررسی و تأیید مدیریت قرار گرفت.",
      );
      handleCloseUploadModal();
    } catch (err) {
      toast.error(
        "خطا در بارگذاری مدرک",
        (err instanceof Error && err.message) || "لطفاً مجدداً تلاش فرمایید.",
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
            typeof d.file === "object" && d.file ? d.file.id : d.file,
          status: d.status,
          rejectionReason: d.rejectionReason,
          uploadedAt: d.uploadedAt,
        }));

      const profile = await api.user.update({ documents: remaining });
      queryClient.setQueryData(queryKeys.auth.profile(userId), profile);

      toast.success("مدرک حذف شد", "فایل مورد نظر از لیست مدارک حذف گردید.");
    } catch (err) {
      toast.error(
        "خطا در حذف مدرک",
        (err instanceof Error && err.message) || "امکان حذف این مدرک وجود ندارد.",
      );
    } finally {
      setIsDeletingDocId(null);
    }
  };

  return {
    showUploadModal,
    openUploadModal: () => setShowUploadModal(true),
    handleCloseUploadModal,
    handleUploadDocument,
    uploadDocType,
    setUploadDocType,
    uploadTitle,
    setUploadTitle,
    uploadFile,
    uploadPreviewUrl,
    fileInputRef,
    handleFileChange,
    clearUploadFile,
    isUploading,
    isDeletingDocId,
    handleDeleteDocument,
  };
}

export type ProfileDocumentUpload = ReturnType<typeof useProfileDocuments>;
