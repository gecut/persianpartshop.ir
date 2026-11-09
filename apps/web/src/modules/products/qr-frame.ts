export interface QrBounds { x: number; y: number; width: number; height: number }

/** Project camera coordinates through object-fit: cover into the square scanner frame. */
export function isQrInsideFrame(bounds: QrBounds, videoWidth: number, videoHeight: number, viewWidth: number, viewHeight: number): boolean {
  if (!videoWidth || !videoHeight || !viewWidth || !viewHeight) return false
  const scale = Math.max(viewWidth / videoWidth, viewHeight / videoHeight)
  const offsetX = (viewWidth - videoWidth * scale) / 2
  const offsetY = (viewHeight - videoHeight * scale) / 2
  const left = bounds.x * scale + offsetX
  const top = bounds.y * scale + offsetY
  return left >= viewWidth * 0.12 && top >= viewHeight * 0.12 &&
    left + bounds.width * scale <= viewWidth * 0.88 && top + bounds.height * scale <= viewHeight * 0.88
}
