import type { ReactNode } from "react";

interface ProductSpecRowProps {
  icon: ReactNode;
  label: ReactNode;
  value?: ReactNode;
  valueTone?: string;
  children?: ReactNode;
}

export function ProductSpecRow({
  icon,
  label,
  value,
  valueTone = "text-foreground",
  children,
}: ProductSpecRowProps) {
  return (
    <div className="p-2 bg-muted/5 rounded-2xl flex items-center gap-2">
      <div className="w-7 h-7 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-xs text-muted font-base block leading-tight mb-0.5">
          {label}
        </span>
        {children ?? (
          <span
            className={`font-bold ${valueTone} text-xs leading-normal truncate block`}
          >
            {value}
          </span>
        )}
      </div>
    </div>
  );
}
