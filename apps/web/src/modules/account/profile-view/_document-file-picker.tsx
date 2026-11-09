import { Button } from "@heroui/react"
import { XIcon, FileTextIcon, PlusIcon } from "@/components/ui/icons"
import type { ChangeEvent, RefObject } from "react"

interface DocumentFilePickerProps {
  file: File | null;
  previewUrl: string | null;
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}

export function DocumentFilePicker({ file, previewUrl, inputRef, onChange, onClear }: DocumentFilePickerProps) {
  return (
    <div className="space-y-1.5 text-start">
      <label className="text-xs font-semibold text-foreground block">
        انتخاب فایل تصویر یا PDF
      </label>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        onChange={onChange}
        className="hidden"
        id="doc-file-input"
      />

      {previewUrl ? (
        <div className="relative rounded-xl overflow-hidden border border-border/20 bg-muted/5 p-2 flex items-center gap-3">
          <img
            src={previewUrl}
            alt="پیش‌نمایش"
            className="size-16 object-cover rounded-lg shrink-0 border border-border/20"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-foreground truncate">
              {file?.name}
            </p>
            <p className="text-[11px] text-muted mt-0.5">
              {((file?.size || 0) / (1024 * 1024)).toFixed(2)}{" "}
              مگابایت
            </p>
          </div>
          <Button
            type="button"
            onPress={onClear}
            className="size-7 rounded-lg bg-danger/10 text-danger hover:bg-danger/20 flex items-center justify-center cursor-pointer"
          >
            <XIcon size={14} />
          </Button>
        </div>
      ) : file ? (
        <div className="rounded-xl border border-border/20 bg-muted/5 p-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 truncate">
            <FileTextIcon
              size={20}
              className="text-muted shrink-0"
            />
            <span className="text-xs font-bold text-foreground truncate">
              {file.name}
            </span>
          </div>
          <Button
            type="button"
            onPress={onClear}
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
  );
}
