import { Button } from "@heroui/react"
import { ZoomInIcon } from "@/components/ui/icons"

export interface GalleryMediaItem {
  id: string;
  url: string;
  label: string;
  isSampleWork: boolean;
}

interface ProductGalleryProps {
  productName: string;
  heroUrl: string;
  items: GalleryMediaItem[];
  onZoom: (url: string) => void;
  onSelect: (url: string) => void;
}

export function ProductGallery({ productName, heroUrl: currentHeroUrl, items: mediaItems, onZoom, onSelect }: ProductGalleryProps) {
  return (
    <div className="space-y-2">
      <div
        className="relative h-48 sm:h-56 w-full shrink-0 overflow-hidden bg-muted/10 rounded-2xl group cursor-pointer"
        onClick={() => onZoom(currentHeroUrl)}
        role="button"
        tabIndex={0}
        aria-label="بزرگ‌نمایی تصویر"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onZoom(currentHeroUrl);
          }
        }}
      >
        <img
          src={currentHeroUrl || "/assets/images/placeholder.svg"}
          alt={productName}
          className="w-full h-full object-cover rounded-2xl"
        />

        <Button
          type="button"
          onPress={() => onZoom(currentHeroUrl)}
          onClick={(e) => {
            e.stopPropagation();
            onZoom(currentHeroUrl);
          }}
          className="absolute bottom-2 inset-e-2 px-3 py-1.5 rounded-lg bg-defualt text-primary-foreground text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-transform active:scale-95"
        >
          <ZoomInIcon size={14} />
          <span>بزرگ‌نمایی</span>
        </Button>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-none">
          {mediaItems.map((item) => {
            const isActive = item.url === currentHeroUrl;
            return (
              <Button
                key={item.id}
                type="button"
                onPress={() => onSelect(item.url)}
                aria-label={item.label}
                className={`group relative size-12 border border-transparent shrink-0 rounded-2xl p-0.5 transition-all cursor-pointer select-none  ${
                  isActive
                    ? "bg-transparent border! border-primary! p-0.5!"
                    : "bg-muted/10 hover:bg-muted/20 opacity-70 hover:opacity-100"
                }`}
              >
                <img
                  src={item.url || "/assets/images/placeholder.svg"}
                  alt=""
                  className="w-full h-full object-cover rounded-2xl transition-transform group-hover:scale-105"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (
                      !target.src.endsWith(
                        "/assets/images/placeholder.svg",
                      )
                    ) {
                      target.src = "/assets/images/placeholder.svg";
                    }
                  }}
                />
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
