import type { ReactNode } from "react"

interface ProfileInfoRowProps {
  icon: ReactNode;
  label: string;
  value: string;
}

export function ProfileInfoRow({ icon, label, value }: ProfileInfoRowProps) {
  return (
    <div className="bg-muted/5 rounded-2xl p-3.5 sm:p-4 flex items-start gap-3">
      {icon}
      <div className="flex-1 text-start">
        <span className="text-xs font-semibold text-muted block">
          {label}
        </span>
        <span className="text-xs sm:text-sm font-bold text-foreground">
          {value}
        </span>
      </div>
    </div>
  );
}
