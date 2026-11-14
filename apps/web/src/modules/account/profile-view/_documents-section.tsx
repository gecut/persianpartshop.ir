import { Button } from "@heroui/react"
import { FileTextIcon, PlusIcon, RefreshCwIcon } from "@/components/ui/icons"
import { DocumentCard } from "./_document-card"
import type { CustomerDocument } from "./_document-types"

interface DocumentsSectionProps {
  documents: CustomerDocument[];
  isLoading: boolean;
  online: boolean;
  deletingId: string | null;
  onUpload: () => void;
  onPreview: (doc: CustomerDocument) => void;
  onDelete: (docId?: string) => void;
}

export function DocumentsSection({ documents, isLoading, online, deletingId, onUpload, onPreview, onDelete }: DocumentsSectionProps) {
  return (
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

        {online && <Button
          type="button"
          onPress={onUpload}
          className="h-8 px-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95"
        >
          <PlusIcon size={14} />
          <span>بارگذاری مدرک</span>
        </Button>}
      </div>
      {!online && <p className="text-xs text-muted">برای باز کردن فایل مدارک به اینترنت وصل شوید.</p>}

      {/* Loading state */}
      {isLoading ? (
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
          {online && <Button
            type="button"
            onPress={onUpload}
            className="mt-3 h-8 px-3.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 font-bold text-xs cursor-pointer inline-flex items-center gap-1"
          >
            <PlusIcon size={14} />
            <span>بارگذاری اولین مدرک</span>
          </Button>}
        </div>
      ) : (
        <div className="space-y-2">
            {documents.map((doc, idx) => (
              <DocumentCard
                key={doc.id || idx}
                doc={doc}
                online={online}
                isDeleting={deletingId === doc.id}
                onPreview={onPreview}
                onDelete={onDelete}
              />
            ))}
        </div>
      )}
    </div>
  );
}
