import React from "react"
import { ZoomInIcon } from "@/components/ui/icons"

interface ProductThumbnailProps {
  src: string;
  alt: string;
  onOpenBottomSheet?: () => void;
}

export const ProductThumbnail = React.memo(function ProductThumbnail({
  src,
  alt,
  onOpenBottomSheet,
}: ProductThumbnailProps) {
  return (
    <div
      data-no-select
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        onOpenBottomSheet?.();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.stopPropagation();
          onOpenBottomSheet?.();
        }
      }}
      className="relative size-19 aspect-square shrink-0 group/img cursor-pointer transition-transform active:scale-95 bg-muted/15 rounded-2xl overflow-hidden"
      title="مشاهده جزئیات کالا"
      aria-label={`مشاهده جزئیات ${alt}`}
    >
      <img
        alt={alt}
        src={src}
        loading="lazy"
        decoding="async"
        className="size-19 aspect-square object-cover rounded-2xl transition-transform duration-200 group-hover/img:scale-105"
        onError={(e) => {
          const target = e.currentTarget;
          if (!target.src.endsWith("/assets/images/placeholder.svg")) {
            target.src = "/assets/images/placeholder.svg";
          }
        }}
      />

      <div className="absolute inset-0 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center rounded-2xl pointer-events-none">
        <span className="p-1 rounded-md bg-primary flex flex-col items-center justify-center size-8 text-primary-foreground">
          <ZoomInIcon size={16} />
        </span>
      </div>
    </div>
  );
});

