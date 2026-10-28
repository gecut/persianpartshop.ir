import assert from 'node:assert/strict'
import { test } from 'node:test'
import sharp, { type Metadata } from 'sharp'
import { Media } from './media.collection'

test('media optimization preserves proportions, transparency and small images', async () => {
  const upload = Media.upload
  assert.ok(upload && typeof upload === 'object')
  assert.ok(upload.resizeOptions)
  assert.ok(upload.formatOptions)
  assert.equal(upload.withMetadata, false)
  assert.deepEqual(upload.mimeTypes, ['image/jpeg', 'image/png', 'image/webp', 'image/avif'])

  for (const [width, height, expectedWidth, expectedHeight] of [
    [2400, 1200, 1600, 800],
    [1200, 2400, 800, 1600],
    [64, 32, 64, 32],
  ]) {
    const input = await sharp({
      create: { width, height, channels: 4, background: { r: 80, g: 120, b: 160, alpha: 0.5 } },
    }).png().withMetadata({ exif: { IFD0: { Artist: 'private' } } }).toBuffer()
    const output: Buffer = await sharp(input).rotate()
      .resize(upload.resizeOptions)
      .toFormat(upload.formatOptions.format, upload.formatOptions.options)
      .toBuffer()
    const metadata: Metadata = await sharp(output).metadata()

    assert.equal(metadata.format, 'webp')
    assert.equal(metadata.width, expectedWidth)
    assert.equal(metadata.height, expectedHeight)
    assert.equal(metadata.hasAlpha, true)
    assert.equal(metadata.exif, undefined)
    assert.ok(output.length < input.length)
  }
})
