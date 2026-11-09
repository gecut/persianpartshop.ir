import { useCallback, useEffect, useState } from "react"
import { Button } from "@heroui/react"
import useEmblaCarousel from "embla-carousel-react"
import { ProductZoomHint } from "./_product-zoom-hint"

export interface GalleryMediaItem {
  id: string;
  url: string;
  label: string;
  isSampleWork: boolean;
}

interface ProductGalleryProps {
  productName: string;
  items: GalleryMediaItem[];
  isOpen: boolean;
  onZoom: (url: string) => void;
}

export function ProductGallery({ productName, items, isOpen, onZoom }: ProductGalleryProps) {
  const [mainRef, mainApi] = useEmblaCarousel({ direction: "rtl" });
  const [thumbRef, thumbApi] = useEmblaCarousel({ direction: "rtl", containScroll: "keepSnaps", dragFree: true });
  const [selected, setSelected] = useState(0);
  const [loadedUrls, setLoadedUrls] = useState<string[]>([]);
  const [hintStarted, setHintStarted] = useState(false);

  const syncSelection = useCallback(() => {
    if (!mainApi) return;
    const index = mainApi.selectedScrollSnap();
    setSelected(index);
    thumbApi?.scrollTo(index);
  }, [mainApi, thumbApi]);

  useEffect(() => {
    if (!mainApi) return;
    syncSelection();
    mainApi.on("select", syncSelection);
    mainApi.on("reInit", syncSelection);
    return () => { mainApi.off("select", syncSelection); mainApi.off("reInit", syncSelection); };
  }, [mainApi, syncSelection]);

  const selectedImageLoaded = loadedUrls.includes(items[selected]?.url ?? "");

  useEffect(() => {
    if (isOpen && selectedImageLoaded) setHintStarted(true);
  }, [isOpen, selectedImageLoaded]);

  return (
    <div className="space-y-2">
      <div className="relative h-48 sm:h-56 w-full overflow-hidden bg-muted/10 rounded-2xl">
        <div ref={mainRef} className="h-full overflow-hidden">
          <div className="flex h-full touch-pan-y">
            {items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className="min-w-0 flex-[0_0_100%] h-full cursor-zoom-in"
                onClick={() => onZoom(item.url)}
                tabIndex={index === selected ? 0 : -1}
                aria-label={`بزرگ‌نمایی ${item.label}`}
              >
                <img
                  src={item.url}
                  alt={index === 0 ? productName : item.label}
                  draggable={false}
                  className="w-full h-full object-cover"
                  onLoad={(event) => { if (!event.currentTarget.dataset.failed) setLoadedUrls((urls) => urls.includes(item.url) ? urls : [...urls, item.url]); }}
                  onError={(event) => { if (!event.currentTarget.dataset.failed) { event.currentTarget.dataset.failed = "true"; event.currentTarget.src = "/assets/images/placeholder.svg"; } }}
                />
              </button>
            ))}
          </div>
        </div>
        {hintStarted && <ProductZoomHint />}
      </div>
      <div ref={thumbRef} className="overflow-hidden pb-1 pt-0.5">
        <div className="flex gap-2 touch-pan-y">
          {items.map((item, index) => (
            <Button
              key={item.id}
              type="button"
              onPress={() => mainApi?.scrollTo(index)}
              aria-label={item.label}
              aria-pressed={index === selected}
              className={`group relative size-12 border border-transparent shrink-0 rounded-2xl p-0.5 transition-all cursor-pointer select-none ${index === selected ? "bg-transparent border! border-primary! p-0.5!" : "bg-muted/10 hover:bg-muted/20 opacity-70 hover:opacity-100"}`}
            >
              <img src={item.url} alt="" draggable={false} className="w-full h-full object-cover rounded-2xl transition-transform group-hover:scale-105" onError={(event) => { if (!event.currentTarget.src.endsWith("/assets/images/placeholder.svg")) event.currentTarget.src = "/assets/images/placeholder.svg"; }} />
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
