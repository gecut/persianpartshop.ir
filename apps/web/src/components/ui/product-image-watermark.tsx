import './product-image-watermark.css'

export function ProductImageWatermark() {
  return (
    <span className="product-image-watermark" aria-hidden="true">
      <span className="product-image-watermark__content">
        <span className="product-image-watermark__logo" />
        بازرگانی زمانیان
      </span>
    </span>
  )
}
