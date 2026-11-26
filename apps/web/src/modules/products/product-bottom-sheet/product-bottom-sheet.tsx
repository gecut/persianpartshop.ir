import { useState, useMemo, useEffect, useLayoutEffect, useRef, useCallback, lazy, Suspense } from "react"
import { Drawer, Button } from "@heroui/react"
import type { Product } from "@/modules/catalog/product-types"
import { toPersianDigits } from "@/lib/utils/currency"
import { useAuth, isProductAllowedForUser } from "@/modules/auth/auth-store"
import { XIcon } from "@/components/ui/icons"
import { ProductGallery, type GalleryMediaItem } from "./_product-gallery"
import { ProductPriceStrip } from "./_product-price-strip"
import { ProductSpecGrid } from "./_product-spec-grid"
import { ProductTagList } from "./_product-tag-list"
import { useFamilyOptions } from "./_use-family-options"
import { ProductFamilyOptions } from "./_product-family-options"

export interface ProductBottomSheetProps {
  product: Product | null;
  isOpen: boolean;
  isSelected?: boolean;
  isOrderingDisabled?: boolean;
  onClose: () => void;
  onToggleSelect?: () => void;
  onRequestSupply?: (product: Product) => void;
  onOrderDirect?: (product: Product) => void;
  onViewProduct?: (product: Product) => void;
}

const ProductImageViewer = lazy(() => import('./_product-image-viewer').then(module => ({ default: module.ProductImageViewer })));

interface ZoomSession {
  productId: string
  items: GalleryMediaItem[]
  initialIndex: number
}

export function ProductBottomSheet({
  product,
  isOpen,
  isSelected = false,
  isOrderingDisabled = false,
  onClose,
  onToggleSelect,
  onRequestSupply,
  onOrderDirect: _onOrderDirect,
  onViewProduct,
}: ProductBottomSheetProps) {
  const [zoomSession, setZoomSession] = useState<ZoomSession | null>(null);
  const [zoomSelection, setZoomSelection] = useState<{ productId: string; item: GalleryMediaItem } | null>(null);
  const closeDrawerButton = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    setZoomSession(null);
    setZoomSelection(null);
  }, [product?.id, isOpen]);

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

  const gallery = activeProduct?.gallery;
  const galleryMediaIds = activeProduct?.galleryMediaIds;
  const galleryMediaDetails = activeProduct?.galleryMediaDetails;
  const mediaItems: GalleryMediaItem[] = useMemo(() => gallery?.map((url, index) => ({
    url,
    id: galleryMediaIds?.[url],
    ...galleryMediaDetails?.[url],
    label: `تصویر ${toPersianDigits(index + 1)}`,
  })) ?? [], [gallery, galleryMediaIds, galleryMediaDetails]);
  const { user } = useAuth();
  const allowed = activeProduct && isProductAllowedForUser(activeProduct, user);
  const viewer = isOpen && allowed && zoomSession?.productId === activeProduct?.id ? zoomSession : null;
  const returnPhoto = zoomSelection?.productId === activeProduct?.id ? zoomSelection?.item ?? null : null;
  const familyOptions = useFamilyOptions(activeProduct?.id, isOpen);

  useEffect(() => {
    if (!viewer && zoomSession) setZoomSession(null);
  }, [viewer, zoomSession]);

  useLayoutEffect(() => {
    if (!isOpen || !returnPhoto || mediaItems.length > 0) return;
    const frame = requestAnimationFrame(() => closeDrawerButton.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [isOpen, mediaItems.length, returnPhoto]);

  // Switching to a sibling unmounts its card, so keep focus inside the drawer and start the new product from the top.
  const viewFamilyOption = useCallback((nextProduct: Product) => {
    onViewProduct?.(nextProduct);
    bodyRef.current?.scrollTo({ top: 0, behavior: "instant" });
    closeDrawerButton.current?.focus({ preventScroll: true });
  }, [onViewProduct]);

  if (!activeProduct || !allowed) return null;

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

                <Button
                  ref={closeDrawerButton}
                  type="button"
                  onClick={onClose}
                  aria-label="بستن"
                  className="w-10 control-height-10 bg-muted/10 hover:bg-muted/20 text-muted hover:text-foreground flex items-center justify-center cursor-pointer transition-colors shrink-0"
                >
                  <XIcon />
                </Button>
              </Drawer.Header>

              {/* Body */}
              <Drawer.Body ref={bodyRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain [--product-details-inset:--spacing(5)] [--product-details-body-bleed:3px] -mx-(--product-details-body-bleed) px-(--product-details-inset) py-2 space-y-2.5 scrollbar-none pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">
                {mediaItems.length > 0 && <ProductGallery
                  key={activeProduct.id}
                  productName={activeProduct.name}
                  items={mediaItems}
                  isOpen={isOpen}
                  isZoomOpen={Boolean(viewer)}
                  zoomSelection={returnPhoto}
                  showProductImageWatermark={user?.showProductImageWatermark === true}
                  onZoom={url => {
                    const initialIndex = mediaItems.findIndex(item => item.url === url);
                    if (initialIndex < 0) return;
                    setZoomSelection(null);
                    setZoomSession({ productId: activeProduct.id, items: mediaItems, initialIndex });
                  }}
                />}

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

                {/* Other Family Members ("طرح") */}
                {onViewProduct && (
                  <ProductFamilyOptions
                    options={familyOptions}
                    activeId={activeProduct.id}
                    onViewProduct={viewFamilyOption}
                  />
                )}

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

      {viewer && (
        <Suspense fallback={null}>
          <ProductImageViewer
            items={viewer.items}
            initialIndex={viewer.initialIndex}
            productName={activeProduct.name}
            showWatermark={user?.showProductImageWatermark === true}
            onClose={item => {
              setZoomSelection({ productId: viewer.productId, item });
              setZoomSession(null);
            }}
          />
        </Suspense>
      )}
    </>
  );
}
