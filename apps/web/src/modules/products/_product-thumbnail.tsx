import { ProductSmallImage } from "@/modules/catalog/product-small-image/product-small-image"
import React from "react"
import { ZoomInIcon } from "@/components/ui/icons"
import type { BlurCss } from "@persianpart/contract"

interface ProductThumbnailProps {
  src: string;
  thumbnail?: string;
  blurCSS?: BlurCss;
  alt: string;
  onOpenBottomSheet?: () => void;
  isCompact?: boolean;
}

export const ProductThumbnail = React.memo(function ProductThumbnail({
  src,
  thumbnail,
  blurCSS,
  alt,
  onOpenBottomSheet,
  isCompact = false,
}: ProductThumbnailProps) {
  if (isCompact) {
    return (
      <ProductSmallImage
        src={src}
        thumbnail={thumbnail}
        alt={alt}
        className="size-14 aspect-square shrink-0 object-cover rounded-xl"
      />
    );
  }
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
      className="relative isolate size-19 aspect-square shrink-0 group/img cursor-pointer transition-transform active:scale-95 bg-muted/15 rounded-2xl overflow-hidden"
      title="مشاهده جزئیات کالا"
      aria-label={`مشاهده جزئیات ${alt}`}
    >
      {blurCSS && <span aria-hidden className="absolute inset-0 -z-10 scale-125 blur-xl pointer-events-none" style={blurCSS} />}
      <ProductSmallImage
        src={src}
        thumbnail={thumbnail}
        alt={alt}
        className="size-19 aspect-square object-cover rounded-2xl transition-transform duration-200 group-hover/img:scale-105"
      />

      <div className="absolute inset-0 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center rounded-2xl pointer-events-none">
        <span className="p-1 rounded-md bg-primary flex flex-col items-center justify-center size-8 text-primary-foreground">
          <ZoomInIcon size={16} />
        </span>
      </div>
    </div>
  );
});

