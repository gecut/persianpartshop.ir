
import { Button } from "@heroui/react"
import { RefreshCwIcon, BoxIcon } from "@/components/ui/icons"

interface EmptyProductsProps {
  onReset: () => void;
}

export function EmptyProducts({ onReset }: EmptyProductsProps) {
  return (
    <div className="bg-muted/5 rounded-2xl p-8 text-center my-4 space-y-2.5">
      <div className="size-12 rounded-2xl bg-default/20 text-muted flex items-center justify-center mx-auto">
        <BoxIcon size={24} />
      </div>
      <h3 className="text-sm font-extrabold text-foreground">
        محصولی با این مشخصات یافت نشد
      </h3>
      <p className="text-xs text-muted max-w-xs mx-auto leading-relaxed">
        با تغییر یا حذف فیلترها، مجدداً جستجو کنید.
      </p>
      <Button
        type="button"
        onClick={onReset}
        className="inline-flex items-center gap-1.5 h-10 px-4 rounded-2xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors cursor-pointer"
      >
        <RefreshCwIcon size={13} />
        <span>پاک کردن فیلترها</span>
      </Button>
    </div>
  );
}
