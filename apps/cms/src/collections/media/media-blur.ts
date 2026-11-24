import sharp from 'sharp'
import { BlurCssSchema, type BlurCss } from '@persianpart/contract'

/** Longest edge of the placeholder grid; the aspect ratio of the image is kept. */
export const blurGridEdge = 8

const percent = (value: number) => `${Number(value.toFixed(2))}%`

/** Builds the Choobinoo-style placeholder: one hard-stop gradient per pixel row. */
export async function createBlurCss(input: Buffer | string): Promise<BlurCss> {
  const { data, info } = await sharp(input)
    .autoOrient()
    .resize({ width: blurGridEdge, height: blurGridEdge, fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const { width, height } = info
  const rows: string[] = []
  const positions: string[] = []
  for (let y = 0; y < height; y++) {
    const stops: string[] = []
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4
      const alpha = data[at + 3]! / 255
      const color = alpha === 1
        ? `rgb(${data[at]}, ${data[at + 1]}, ${data[at + 2]})`
        : `rgba(${data[at]}, ${data[at + 1]}, ${data[at + 2]}, ${Number(alpha.toFixed(2))})`
      stops.push(`${color} ${percent((x / width) * 100)} ${percent(((x + 1) / width) * 100)}`)
    }
    rows.push(`linear-gradient(90deg, ${stops.join(', ')})`)
    positions.push(`0 ${percent(height > 1 ? (y / (height - 1)) * 100 : 0)}`)
  }
  return BlurCssSchema.parse({
    backgroundImage: rows.join(', '),
    backgroundPosition: positions.join(', '),
    backgroundSize: `100% ${percent(100 / height)}`,
    backgroundRepeat: 'no-repeat',
  })
}
