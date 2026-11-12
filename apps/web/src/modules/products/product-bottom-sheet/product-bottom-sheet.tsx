import { useState, useMemo, useEffect, useLayoutEffect, lazy, Suspense } from "react"
import { Drawer, Button } from "@heroui/react"
import type { Product } from "@/modules/products/product-types"
import { toPersianDigits } from "@/lib/utils/currency"
import { ImageViewerModal } from "@/components/ui/image-viewer-modal"
import { useAuth, isProductAllowedForUser } from "@/modules/auth/auth-store"
import { XIcon } from "@/components/ui/icons"
import { ProductGallery, type GalleryMediaItem } from "./_product-gallery"
import { ProductPriceStrip } from "./_product-price-strip"
import { ProductSpecGrid } from "./_product-spec-grid"
import { ProductTagList } from "./_product-tag-list"

export interface ProductBottomSheetProps {
  product: Product | null;
  isOpen: boolean;
  isSelected?: boolean;
  isOrderingDisabled?: boolean;
  onClose: () => void;
  onToggleSelect?: () => void;
  onRequestSupply?: (product: Product) => void;
  onOrderDirect?: (product: Product) => void;
}

const ProductQrDownload = lazy(() => import('../product-qr-download').then(module => ({ default: module.ProductQrDownload })));

export function ProductBottomSheet({
  product,
  isOpen,
  isSelected = false,
  isOrderingDisabled = false,
  onClose,
  onToggleSelect,
  onRequestSupply,
  onOrderDirect: _onOrderDirect,
}: ProductBottomSheetProps) {
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);

  useLayoutEffect(() => { setQrOpen(false) }, [product?.id, isOpen]);

  // Preserve rendered product for smooth close transitions
  const [renderedProduct, setRenderedProduct] = useState<Product | null>(
    product,
  );

  useEffect(() => {
    if (product) {
      setRenderedProduct(product);
    }
  }, [product]);

  const activeProduct = product || renderedProduct;

  // Consolidate tile angles and sample works into a unified gallery
  const mediaItems: GalleryMediaItem[] = useMemo(() => {
    if (!activeProduct) return [];
    const items: GalleryMediaItem[] = [];
    const seen = new Set<string>();

    const all = [
      ...(activeProduct.images || []),
      ...(activeProduct.gallery || []),
    ].filter(Boolean);

    all.forEach((url, idx) => {
      if (!seen.has(url)) {
        seen.add(url);
        items.push({
          id: `media-${idx}`,
          url,
          label: idx === 0 ? "تصویر اصلی" : `نمونه‌کار ${toPersianDigits(idx)}`,
          isSampleWork: idx > 0,
        });
      }
    });

    if (items.length === 0) {
      items.push({
        id: "placeholder",
        url: "/assets/images/placeholder.svg",
        label: "تصویر شاخص",
        isSampleWork: false,
      });
    }

    return items;
  }, [activeProduct]);

  const { user } = useAuth();
  if (!activeProduct || !isProductAllowedForUser(activeProduct, user)) return null;

  const isOutOfStock =
    activeProduct.stockStatus === "out_of_stock" ||
    activeProduct.inStock === false ||
    (Number.isFinite(Number(activeProduct.inventorySqm)) &&
      Number(activeProduct.inventorySqm) <= 0);

  return (
    <>
      <Drawer>
        <Drawer.Backdrop
          isOpen={isOpen}
          onOpenChange={(open) => !open && onClose()}
          shouldCloseOnInteractOutside={() => false}
          isKeyboardDismissDisabled
          className="fixed z-50  bg-foreground/30 min-h-60 flex items-end justify-center fade-up transition-all duration-300"
        >
          <Drawer.Content
            placement="bottom"
            className="w-full max-w-xl sm:max-w-2xl mx-auto fixed z-50 bottom-0! mb-0! inset-x-0 top-auto h-auto! max-h-[92dvh] sm:max-h-[94dvh] rounded-t-3xl rounded-b-none! flex flex-col overflow-hidden border-b-0! "
          >
            <Drawer.Dialog className="flex flex-col bg-background h-auto! max-h-[92dvh] sm:max-h-[94dvh] min-h-0 outline-none text-start overscroll-contain m-0! mb-0! p-0! rounded-b-none!">
              {/* Drag Handle UI */}
              <div className="flex justify-center w-full shrink-0 pt-2 pb-1">
                <Drawer.Handle className="w-16 h-1.5 rounded-full" />
              </div>

              <Drawer.Header className="w-full flex flex-row! items-center justify-between px-5 pt-1 pb-1 shrink-0">
                <div className="min-w-0 flex-1 flex flex-col items-start text-start">
                  <Drawer.Heading className="text-sm font-extrabold text-foreground mt-0.5 text-start leading-snug">
                    {activeProduct.name}
                  </Drawer.Heading>
                </div>

                {user?.canUseProductQr && activeProduct.hasScanCode && <Button type="button" isIconOnly variant="ghost" onPress={() => setQrOpen(value => !value)} aria-label="دریافت QR محصول" aria-expanded={qrOpen} className="w-10 control-height-10 shrink-0 bg-muted/10 text-muted hover:bg-muted/20 hover:text-foreground"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM19 14v2M14 19h2M19 19h1"/></svg></Button>}
                <Button
                  type="button"
                  onClick={onClose}
                  aria-label="بستن"
                  className="w-10 control-height-10 bg-muted/10 hover:bg-muted/20 text-muted hover:text-foreground flex items-center justify-center cursor-pointer transition-colors shrink-0"
                >
                  <XIcon />
                </Button>
              </Drawer.Header>

              {/* Body */}
              <Drawer.Body className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-2 space-y-2.5 scrollbar-none pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">
                {qrOpen && <Suspense fallback={<p role="status">در حال آماده‌سازی…</p>}><ProductQrDownload productId={activeProduct.id} /></Suspense>}
                <ProductGallery
                  key={`${activeProduct.id}-${isOpen}`}
                  productName={activeProduct.name}
                  items={mediaItems}
                  isOpen={isOpen}
                  showProductImageWatermark={user?.showProductImageWatermark === true}
                  onZoom={setZoomImageUrl}
                />

                {/* Price & Selection Action Strip */}
                <ProductPriceStrip
                  product={activeProduct}
                  isSelected={isSelected}
                  isOrderingDisabled={isOrderingDisabled}
                  isOutOfStock={isOutOfStock}
                  onToggleSelect={onToggleSelect}
                  onRequestSupply={onRequestSupply}
                />

                {/* Structured Specifications with Solar Icons */}
                <ProductSpecGrid product={activeProduct} />

                {/* Optional Rich Description */}
                {(activeProduct.richDescription ||
                  activeProduct.description) && (
                  <div className="p-3 bg-muted/5 rounded-2xl space-y-1">
                    <span className="text-xs font-bold text-muted block">
                      توضیحات
                    </span>
                    <p className="text-xs text-foreground leading-relaxed">
                      {activeProduct.richDescription ||
                        activeProduct.description}
                    </p>
                  </div>
                )}

                {/* Tags and Badges */}
                {((activeProduct.tags && activeProduct.tags.length > 0) ||
                  activeProduct.approxCoverage ||
                  activeProduct.grade) && <ProductTagList product={activeProduct} />}
              </Drawer.Body>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>

      {/* Standalone Image Viewer Lightbox */}
      {zoomImageUrl && (
        <ImageViewerModal
          isOpen={Boolean(zoomImageUrl)}
          onClose={() => setZoomImageUrl(null)}
          imageUrl={zoomImageUrl}
          title={activeProduct.name}
          showProductImageWatermark={user?.showProductImageWatermark === true}
        />
      )}
    </>
  );
}
