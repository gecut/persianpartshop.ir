import { Button } from "@heroui/react"
import { formatPersianDate } from "@/lib/utils/date"
import { AlertCircleIcon, LockIcon, FileTextIcon, Trash2Icon, CheckCircle2Icon, ClockIcon, RefreshCwIcon, ZoomInIcon } from "@/components/ui/icons"
import { getDocFileUrl, getDocumentTypeLabel, type CustomerDocument } from "./_document-types"
import { match, P } from "ts-pattern"

interface DocumentCardProps {
  doc: CustomerDocument;
  isDeleting: boolean;
  online: boolean;
  onPreview: (doc: CustomerDocument) => void;
  onDelete: (docId?: string) => void;
}

export function DocumentCard({ doc, isDeleting, online, onPreview, onDelete }: DocumentCardProps) {
  const fileUrl = online ? getDocFileUrl(doc.file) : null;
  const isRejected = doc.status === "rejected";

  const statusBadge = match(doc.status)
    .with("approved", () => (
      <span className="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold bg-success/15 text-success flex items-center gap-1">
        <CheckCircle2Icon size={12} />
        <span>تایید شده</span>
      </span>
    ))
    .with("rejected", () => (
      <span className="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold bg-danger/15 text-danger flex items-center gap-1">
        <AlertCircleIcon size={12} />
        <span>لغو شده</span>
      </span>
    ))
    .with(P.union("pending", P.nullish), () => (
      <span className="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold bg-warning/15 text-warning flex items-center gap-1">
        <ClockIcon size={12} />
        <span>منتظر تایید ادمین</span>
      </span>
    ))
    .otherwise(() => null);

  const actionButton = match(doc.status)
    .with("approved", () => (
      <div
        className="size-8 rounded-xl bg-success/10 text-success flex items-center justify-center cursor-not-allowed"
        title="مدرک تأیید شده قفل است و امکان تغییر یا حذف آن وجود ندارد."
      >
        <LockIcon size={14} />
      </div>
    ))
    .otherwise(() => (
      <Button
        type="button"
        onPress={() => onDelete(doc.id)}
        isDisabled={!online || isDeleting}
        className="size-8 rounded-xl bg-danger/10 text-danger hover:bg-danger/20 flex items-center justify-center cursor-pointer transition-all active:scale-95"
        aria-label="حذف مدرک"
      >
        {isDeleting ? (
          <RefreshCwIcon size={13} className="animate-spin" />
        ) : (
          <Trash2Icon size={14} />
        )}
      </Button>
    ));

  return (
    <div
      className="bg-background/80 border border-border/15 rounded-xl p-3 flex flex-col gap-2 transition-all"
    >
      <div className="flex items-center gap-3">
        {/* Thumbnail */}
        {fileUrl ? (
          <button
            type="button"
            onClick={() => onPreview(doc)}
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
          <div className="flex w-full items-center justify-between gap-1">
            <h4 className="text-xs sm:text-sm font-bold text-foreground truncate">
              {getDocumentTypeLabel(doc.documentType) ||
                doc.title ||
                "مدرک بارگذاری شده"}
            </h4>
          </div>

          {doc.title &&
            doc.title !==
              getDocumentTypeLabel(doc.documentType) && (
              <p className="text-[11px] text-muted truncate mt-0.5">
                {doc.title}
              </p>
            )}

          {/* Date & Status */}
          <div className="flex items-center gap-2 mt-1 text-[11px] text-muted">
            <span>{formatPersianDate(doc.uploadedAt)}</span>
            {statusBadge}
          </div>
        </div>

        {/* Action: strictly locked if approved, deletable if pending or rejected */}
        <div className="shrink-0">
          {actionButton}
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
}
