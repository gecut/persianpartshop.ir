const dialog = document.querySelector('dialog')
const stage = document.querySelector('#stage')
const photo = document.querySelector('#viewer-photo')
const visiblePhoto = document.querySelector('#visible-photo')
const title = document.querySelector('#viewer-title')
const zoomIn = document.querySelector('#zoom-in')
const zoomOut = document.querySelector('#zoom-out')
const zoomReset = document.querySelector('#zoom-reset')
const showMark = document.querySelector('#show-mark')
const opacity = document.querySelector('#mark-opacity')
const opacityValue = document.querySelector('#opacity-value')
const percent = new Intl.NumberFormat('fa-IR', { style: 'percent' })
const maxScale = 4
const pointers = new Map()
let scale = 1
let x = 0
let y = 0
let aspect = 1

function render() {
  const stageWidth = stage.clientWidth
  const stageHeight = stage.clientHeight
  if (!stageWidth || !stageHeight) return

  const baseWidth = Math.min(stageWidth, stageHeight * aspect)
  const baseHeight = baseWidth / aspect
  const width = baseWidth * scale
  const height = baseHeight * scale
  const maxX = Math.max(0, (width - stageWidth) / 2)
  const maxY = Math.max(0, (height - stageHeight) / 2)
  x = Math.min(maxX, Math.max(-maxX, x))
  y = Math.min(maxY, Math.max(-maxY, y))

  const left = (stageWidth - width) / 2 + x
  const top = (stageHeight - height) / 2 + y
  photo.style.width = `${baseWidth}px`
  photo.style.height = `${baseHeight}px`
  photo.style.transform = `translate3d(${left}px, ${top}px, 0) scale(${scale})`

  // Anchor the stamp to the intersection of the photo and the viewport.
  visiblePhoto.style.left = `${Math.max(0, left)}px`
  visiblePhoto.style.top = `${Math.max(0, top)}px`
  visiblePhoto.style.right = `${Math.max(0, stageWidth - left - width)}px`
  visiblePhoto.style.bottom = `${Math.max(0, stageHeight - top - height)}px`
  stage.toggleAttribute('data-zoomed', scale > 1)
  zoomIn.disabled = scale >= maxScale
  zoomOut.disabled = scale <= 1
  zoomReset.textContent = percent.format(scale)
}

function resetZoom() {
  scale = 1
  x = 0
  y = 0
  render()
}

function zoomAt(requestedScale, originX = 0, originY = 0, dx = 0, dy = 0) {
  const nextScale = Math.max(1, Math.min(maxScale, requestedScale))
  const ratio = nextScale / scale
  x = originX - (originX - x) * ratio + dx
  y = originY - (originY - y) * ratio + dy
  scale = nextScale
  render()
}

function pointerPosition(event) {
  const bounds = stage.getBoundingClientRect()
  return {
    x: event.clientX - bounds.left - bounds.width / 2,
    y: event.clientY - bounds.top - bounds.height / 2,
  }
}

function pinchGeometry() {
  const [first, second] = pointers.values()
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
    distance: Math.hypot(first.x - second.x, first.y - second.y),
  }
}

document.querySelectorAll('.sample').forEach((sample) => {
  sample.addEventListener('click', () => {
    const image = sample.querySelector('img')
    if (!image.naturalWidth) return

    dialog.dataset.tone = sample.dataset.tone
    title.textContent = sample.dataset.title
    aspect = image.naturalWidth / image.naturalHeight
    photo.src = image.currentSrc
    dialog.showModal()
    resetZoom()
  })
})

document.querySelector('#close-viewer').addEventListener('click', () => dialog.close())
dialog.addEventListener('close', () => pointers.clear())
zoomIn.addEventListener('click', () => zoomAt(scale + .5))
zoomOut.addEventListener('click', () => zoomAt(scale - .5))
zoomReset.addEventListener('click', resetZoom)
new ResizeObserver(render).observe(stage)

showMark.addEventListener('change', () => {
  document.body.toggleAttribute('data-hide-mark', !showMark.checked)
})
opacity.addEventListener('input', () => {
  const value = opacity.valueAsNumber / 100
  document.documentElement.style.setProperty('--stamp-opacity', value)
  opacityValue.value = percent.format(value)
})

stage.addEventListener('wheel', (event) => {
  event.preventDefault()
  const point = pointerPosition(event)
  zoomAt(scale + (event.deltaY < 0 ? .25 : -.25), point.x, point.y)
}, { passive: false })

stage.addEventListener('dblclick', (event) => {
  const point = pointerPosition(event)
  zoomAt(scale > 1 ? 1 : 2, point.x, point.y)
})

stage.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || pointers.size === 2) return
  stage.setPointerCapture(event.pointerId)
  pointers.set(event.pointerId, pointerPosition(event))
})

stage.addEventListener('pointermove', (event) => {
  const previousPoint = pointers.get(event.pointerId)
  if (!previousPoint) return

  const point = pointerPosition(event)
  if (pointers.size === 2) {
    const previous = pinchGeometry()
    pointers.set(event.pointerId, point)
    const next = pinchGeometry()
    if (previous.distance > 0) {
      zoomAt(scale * next.distance / previous.distance, previous.x, previous.y,
        next.x - previous.x, next.y - previous.y)
    }
    return
  }

  pointers.set(event.pointerId, point)
  x += point.x - previousPoint.x
  y += point.y - previousPoint.y
  render()
})

stage.addEventListener('lostpointercapture', (event) => pointers.delete(event.pointerId))
