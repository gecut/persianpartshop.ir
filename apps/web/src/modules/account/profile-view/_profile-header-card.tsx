import { Button } from "@heroui/react"
import { StoreIcon, LogOutIcon } from "@/components/ui/icons"

interface ProfileHeaderCardProps {
  name: string;
  storeName: string;
  onLogout: () => void;
}

export function ProfileHeaderCard({ name, storeName, onLogout }: ProfileHeaderCardProps) {
  return (
    <div className="bg-muted/5 rounded-2xl p-4 flex items-center justify-between gap-2">
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <h2 className="text-base font-bold text-foreground">
              {name}
            </h2>
          </div>
          <p className="text-xs text-muted mt-0.5 flex items-center gap-1">
            <StoreIcon size={12} className="text-muted shrink-0" />
            <span className="truncate max-w-50">{storeName}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          type="button"
          onPress={onLogout}
          className="control-height-10 px-4 bg-danger/15 text-danger hover:bg-danger/20 text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95"
          aria-label="خروج از حساب"
        >
          <LogOutIcon size={14} />
          <span>خروج</span>
        </Button>
      </div>
    </div>
  );
}
