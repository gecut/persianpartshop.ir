import './product-image-watermark.css'

export function ProductImageWatermark() {
  return (
    <span className="product-image-watermark" aria-hidden="true">
      <span className="product-image-watermark__logo" />
      <span className="product-image-watermark__text">
        <span className="product-image-watermark__title">کاشی پرسپولیس</span>
        <span className="product-image-watermark__subtitle">بازرگانی زمانیان</span>
      </span>
    </span>
  )
}
