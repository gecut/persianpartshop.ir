import { updateSavedOfflineRecord } from '@/modules/pwa/offline-package'
import { offlineRecoveryEnabled } from '@/modules/pwa/read-source'
import { PwaAccountButton } from '@/modules/pwa/pwa-account-button'
import { QueryLoadError } from '@/components/feedback/query-load-error'
import { useTextDraft } from '@/lib/drafts'
import { useWriteActivity } from '@/lib/write-activity'
import { useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { useAuth } from "@/modules/auth/auth-store"
import { api } from "@/lib/api-client"
import { queryKeys } from "@/lib/query-keys"
import { toast } from "@/components/feedback/toast"
import { SignedOutCard } from "./_signed-out-card"
import { ProfileHeaderCard } from "./_profile-header-card"
import { ProfileDetailsCard } from "./_profile-details-card"
import { DocumentsSection } from "./_documents-section"
import { EditProfileDrawer } from "./_edit-profile-drawer"
import { UploadDocumentModal } from "./_upload-document-modal"
import { ImagePreviewModal } from "./_image-preview-modal"
import { LogoutConfirmModal } from "./_logout-confirm-modal"
import { useProfileDocuments } from "./_use-profile-documents"
import type { CustomerDocument } from "./_document-types"
import { useNetworkReadSource } from '@/modules/pwa/read-source'
import { OfflineAccountCard } from '@/modules/pwa/offline-account-card'
import { useOnline } from '@/lib/use-online'
import { useSavedOfflinePackage } from '@/modules/pwa/offline-package'

export function ProfileView() {
  const pendingWrites = useWriteActivity();
  const navigate = useNavigate();

  const { user, logout, updateProfile } = useAuth();
  const online = useOnline();
  const networkRead = useNetworkReadSource();
  const { active, restoring } = useSavedOfflinePackage();
  const savedProfile = active?.data.profile;
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Profile Query from API to get documents and real-time status
  const {
    data: profileDoc,
    isPending: isProfilePending,
    error: profileError,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: queryKeys.auth.profile(user?.id),
    queryFn: ({ signal }) => api.user.profile(undefined, { signal }),
    staleTime: 120_000,
    refetchOnReconnect: 'always',
    enabled: !!user && networkRead,
  });

  const documents =
    (networkRead ? profileDoc?.documents as CustomerDocument[] | undefined : savedProfile?.documents) ?? [];

  const docs = useProfileDocuments({ documents, userId: user?.id });

  // State for previewing full-size document
  const [previewDoc, setPreviewDoc] = useState<CustomerDocument | null>(null);

  const [formData, setFormData, discardProfileDraft] = useTextDraft(user?.id ?? '', 'profile', {
    name: user?.name || "",
    storeName: user?.storeName || "",
    address: user?.address || "",
  });

  if (!user) {
    return <SignedOutCard onLogin={() => navigate({ to: "/login" })} />;
  }

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
    if (!online || pendingWrites > 0) return;

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
      if (offlineRecoveryEnabled) void updateSavedOfflineRecord({ kind: 'profile' }).catch(() => {})
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

  return (
    <div className="space-y-3.5 w-full">
      <PwaAccountButton />
      <OfflineAccountCard />
      <ProfileHeaderCard
        name={(!networkRead && savedProfile?.name) || user.name}
        storeName={(!networkRead && savedProfile?.storeName) || user.storeName}
        onLogout={() => setShowLogoutConfirm(true)}
      />

      <ProfileDetailsCard
        name={(!networkRead && savedProfile?.name) || user.name}
        storeName={(!networkRead && savedProfile?.storeName) || user.storeName}
        phone={(!networkRead && savedProfile?.phone) || user.phone}
        onEdit={() => setIsEditing(true)}
      />

      {!networkRead && !restoring && !savedProfile ? (
        <p role="status">برای دریافت اطلاعات مدارک به اینترنت وصل شوید.</p>
      ) : networkRead && profileError && !profileDoc ? (
        <QueryLoadError message="دریافت مدارک حساب ممکن نشد." onRetry={() => void refetchProfile()} />
      ) : (
        <DocumentsSection
          documents={documents}
          isLoading={networkRead ? isProfilePending : !!restoring}
          online={online}
          deletingId={docs.isDeletingDocId}
          onUpload={docs.openUploadModal}
          onPreview={setPreviewDoc}
          onDelete={docs.handleDeleteDocument}
        />
      )}

      <EditProfileDrawer
        isOpen={isEditing}
        formData={formData}
        setFormData={setFormData}
        phone={user.phone}
        isSaveDisabled={!online || pendingWrites > 0}
        onCancel={handleCancelEdit}
        onSubmit={handleSaveProfile}
      />

      {online && <UploadDocumentModal upload={docs} isSubmitDisabled={pendingWrites > 0} />}

      {online && <ImagePreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}

      <LogoutConfirmModal
        isOpen={showLogoutConfirm}
        isConfirmDisabled={pendingWrites > 0 || docs.isUploading || !!docs.isDeletingDocId}
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
      />
    </div>
  );
}
