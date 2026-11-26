import path from 'node:path'
import QRCode from 'qrcode'
import sharp from 'sharp'
import { openSync, type Font } from 'fontkit'
import { justifyKashida } from './kashida'

// The CMS container has one CPU; libvips otherwise starts one thread per host core and keeps an operation cache.
// These settings are process-wide, so media upload resizing in the CMS uses them too.
sharp.concurrency(1)
sharp.cache(false)

export const LABEL = {
  widthMm: 60,
  heightMm: 80,
  pixelsPerMm: 40, // 2400 x 3200 px
  sideGap: 3, // modules, border inner edge -> code (left/right)
  border: 0.3, // modules
  cut: 0.65, // modules, cut line -> border centerline
  chamfer: 2, // modules
  captionWidth: 33, // modules, equals the code width
  lineGap: 1.2, // modules between the two caption lines
  headlineSize: 1.5, // headline = 1.5 x sentence
  headline: 'قیمت و ویژگی‌های کالا',
  sentence: 'برای مشاهدهٔ جزئیات کامل، اسکن کنید',
  red: '#ae0f17',
  black: '#14120f',
} as const

type Matrix = { size: number; get(row: number, col: number): number; isReserved(row: number, col: number): boolean }

let cachedFont: Font | undefined
function loadFont(): Font {
  cachedFont ??= openSync(path.join(process.cwd(), 'public/fonts/PEYDA-MEDIUM.TTF')) as Font
  return cachedFont
}
const shape = (text: string) => loadFont().layout(text, undefined, 'arab', 'FAR ', 'rtl')
const inkWidth = (text: string) => {
  const box = shape(text).bbox
  return box.maxX - box.minX
}

// --- QR geometry helpers (units: modules) ----------------------------------
const rect = (x: number, y: number, size: number) => `<rect x="${x}" y="${y}" width="${size}" height="${size}"/>`

function contour(x: number, y: number, w: number, [a, b, c, d]: [number, number, number, number]) {
  return `M${x + a} ${y}H${x + w - b}q${b} 0 ${b} ${b}V${y + w - c}q0 ${c} -${c} ${c}H${x + d}q-${d} 0 -${d} -${d}V${y + a}q0 -${a} ${a} -${a}Z`
}

/** Rounded "liquid" shape for one data module, joined to its neighbours. */
function liquidCell(x: number, y: number, on: (x: number, y: number) => boolean) {
  const neighbors = [on(x, y - 1), on(x + 1, y), on(x, y + 1), on(x - 1, y)]
  if (on(x, y)) {
    const radii = neighbors.map((v, i) => (v || neighbors[(i + 3) % 4] ? 0 : 0.43)) as [number, number, number, number]
    return contour(x, y, 1, radii)
  }
  let d = ''
  const corners: Array<[number, number, number, number, number]> = [
    [0, x, y, 1, 1],
    [1, x + 1, y, -1, 1],
    [2, x + 1, y + 1, -1, -1],
    [3, x, y + 1, 1, -1],
  ]
  for (const [i, cx, cy, sx, sy] of corners) {
    if (neighbors[i] && neighbors[(i + 3) % 4] && on(x - sx, y - sy)) {
      d += `M${cx} ${cy}h${sx * 0.32}q${-sx * 0.32} 0 ${-sx * 0.32} ${sy * 0.32}Z`
    }
  }
  return d
}

/** Octagonal finder eye (outer ring, white gap, solid centre). */
function finder(x: number, y: number, rotation: number) {
  let body = ''
  const rings: Array<[number, number, string]> = [
    [0, 7, 'currentColor'],
    [1, 5, 'white'],
    [2, 3, 'currentColor'],
  ]
  for (const [inset, w, fill] of rings) {
    const k = w * (inset === 2 ? 0.23 : 0.14)
    body += `<path transform="translate(${inset} ${inset})" fill="${fill}" d="M${k} 0H${w - k}L${w} ${k}V${w - k}L${w - k} ${w}H${k}L0 ${w - k}V${k}Z"/>`
  }
  return `<g transform="translate(${x} ${y}) rotate(${rotation} 3.5 3.5)">${body}</g>`
}

// --- Caption ---------------------------------------------------------------
function textLine(text: string, scale: number, centerX: number, topY: number) {
  const run = shape(text)
  const box = run.bbox
  const x = centerX - ((box.minX + box.maxX) * scale) / 2
  const baseline = topY + box.maxY * scale
  let cursor = 0
  const paths = run.glyphs.map((glyph, i) => {
    const pos = run.positions[i]
    const d = glyph.path.toSVG()
    const part = d && pos ? `<path transform="translate(${cursor + pos.xOffset} ${pos.yOffset})" d="${d}"/>` : ''
    if (pos) cursor += pos.xAdvance
    return part
  })
  return {
    svg: `<g fill="${LABEL.black}" transform="translate(${x} ${baseline}) scale(${scale} ${-scale})">${paths.join('')}</g>`,
    height: (box.maxY - box.minY) * scale,
  }
}

/** Two justified lines, both exactly `width` modules wide, drawn with their top edge at y = 0. */
function captionBlock(width: number, centerX: number) {
  const sentenceScale = width / inkWidth(LABEL.sentence)
  const headlineScale = sentenceScale * LABEL.headlineSize
  const headline = justifyKashida(LABEL.headline, width / headlineScale, inkWidth)
  const headlineFinal = width / inkWidth(headline) // tiny correction so the edges land exactly
  const a = textLine(headline, headlineFinal, centerX, 0)
  const b = textLine(LABEL.sentence, sentenceScale, centerX, a.height + LABEL.lineGap)
  return { svg: a.svg + b.svg, height: a.height + LABEL.lineGap + b.height }
}

// --- Layout ----------------------------------------------------------------
export interface LabelGeometry {
  widthMm: number
  heightMm: number
  sideGap: number
  verticalGap: number
  topGap: number
  captionGap: number
  bottomGap: number
}

export async function renderLabel(url: string): Promise<{ png: Buffer; geometry: LabelGeometry }> {
  const { modules } = QRCode.create(url, { errorCorrectionLevel: 'H' })
  const matrix = modules as unknown as Matrix
  const n = matrix.size
  const innerPad = LABEL.cut + LABEL.border / 2 // cut line -> inner edge of the border ink
  const w = n + 2 * (innerPad + LABEL.sideGap)
  const mmPerModule = LABEL.widthMm / w
  const h = LABEL.heightMm / mmPerModule
  const caption = captionBlock(n, w / 2)
  const verticalGap = (h - (2 * innerPad + n + caption.height)) / 3
  if (verticalGap < LABEL.sideGap) throw new RangeError('Label content does not fit 60 x 80 mm')
  const qx = innerPad + LABEL.sideGap
  const qy = innerPad + verticalGap
  const captionTop = qy + n + verticalGap

  const a = LABEL.cut
  const b = w - a
  const z = h - a
  const k = LABEL.chamfer
  const border = `<path fill="none" stroke="${LABEL.red}" stroke-width="${LABEL.border}" stroke-linejoin="round" d="M${a + k} ${a}H${b - k}l${k} ${k}V${z - k}l-${k} ${k}H${a + k}l-${k} -${k}V${a + k}Z"/>`

  const eyes: Array<[number, number, number]> = [[0, 0, 0], [n - 7, 0, 90], [0, n - 7, -90]]
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < n && y < n && matrix.get(y, x) === 1
  let squares = ''
  let liquid = ''
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (eyes.some(([ex, ey]) => x >= ex && x < ex + 7 && y >= ey && y < ey + 7)) continue
      if (!matrix.isReserved(y, x)) liquid += liquidCell(x, y, on)
      else if (on(x, y)) squares += rect(x, y, 1)
    }
  }
  const code = `<g transform="translate(${qx} ${qy})"><g color="${LABEL.black}" fill="${LABEL.black}">${squares}<path d="${liquid}"/></g><g color="${LABEL.red}">${eyes.map(([x, y, r]) => finder(x, y, r)).join('')}</g></g>`
  const widthPx = LABEL.widthMm * LABEL.pixelsPerMm
  const heightPx = LABEL.heightMm * LABEL.pixelsPerMm
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="white"/>${border}${code}<g transform="translate(0 ${captionTop})">${caption.svg}</g></svg>`
  const png = await sharp(Buffer.from(svg))
    .flatten({ background: 'white' })
    .removeAlpha()
    .withIccProfile('srgb')
    .withMetadata({ density: Math.round(LABEL.pixelsPerMm * 25.4) })
    .png()
    .toBuffer()
  return {
    png,
    geometry: {
      widthMm: LABEL.widthMm,
      heightMm: h * mmPerModule,
      sideGap: LABEL.sideGap,
      verticalGap,
      topGap: qy - innerPad,
      captionGap: captionTop - (qy + n),
      bottomGap: h - innerPad - (captionTop + caption.height),
    },
  }
}
