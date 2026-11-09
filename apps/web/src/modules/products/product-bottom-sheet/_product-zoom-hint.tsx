import "./_product-zoom-hint.css"

// Mounted once the open gallery's selected image has loaded. CSS owns the timeline.
export function ProductZoomHint() {
  return (
    <div aria-hidden="true" className="product-zoom-hint pointer-events-none absolute inset-0">
      <div className="product-zoom-hint__backdrop absolute inset-0 bg-black/55 backdrop-blur-md" />
      <div className="product-zoom-hint__text absolute inset-0 flex items-center justify-center text-white">
        <span className="whitespace-nowrap text-[10px]">برای بزرگ شدن تصویر ضربه بزنید</span>
      </div>
    </div>
  );
}
