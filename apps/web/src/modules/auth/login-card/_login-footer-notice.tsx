import { ShieldCheckIcon } from "@/components/ui/icons"

export function LoginFooterNotice() {
  return (
    <div className="mt-7 pt-4 text-center">
      <div className="mb-1 flex items-center justify-center gap-1.5 text-xs text-muted">
        <ShieldCheckIcon size={14} className="shrink-0 text-primary/70" />
        <span>
          افتتاح حساب مشتریان جدید منحصراً توسط مدیریت انجام می‌شود.
        </span>
      </div>

      <p className="text-xs text-muted/70">
        پشتیبانی امور نمایندگان:{" "}
        <span className="font-bold text-foreground/80" dir="ltr">
          ۰۲۱-۸۸۸۸۸۸۸۸
        </span>
      </p>
    </div>
  );
}
