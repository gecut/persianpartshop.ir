import assert from 'node:assert/strict'
import test from 'node:test'
import jsQR from 'jsqr'
import sharp from 'sharp'
import { LABEL, renderLabel } from './render-label'

const url = 'HTTPS://CATALOG.PERSIANPARTSHOP.IR/Q/K7XP2MQA'

test('label is exactly 60 x 80 mm at 2400 x 3200 px, opaque sRGB', async () => {
  const { png, geometry } = await renderLabel(url)
  const meta = await sharp(png).metadata()
  assert.equal(meta.width, 2400)
  assert.equal(meta.height, 3200)
  assert.equal(meta.hasAlpha, false)
  assert.equal(meta.space, 'srgb')
  assert.equal(geometry.widthMm, 60)
  assert.ok(Math.abs(geometry.heightMm - 80) < 0.001)
})

test('side gap is 3 modules; top, code-to-caption and bottom gaps are equal', async () => {
  const { geometry } = await renderLabel(url)
  assert.ok(Math.abs(geometry.sideGap - LABEL.sideGap) < 1e-9)
  assert.ok(geometry.verticalGap >= geometry.sideGap)
  assert.ok(Math.abs(geometry.topGap - geometry.verticalGap) < 1e-9)
  assert.ok(Math.abs(geometry.captionGap - geometry.verticalGap) < 1e-9)
  assert.ok(Math.abs(geometry.bottomGap - geometry.verticalGap) < 1e-9)
})

test('the rendered PNG decodes to exactly the input URL', async () => {
  const { png } = await renderLabel(url)
  const { data, info } = await sharp(png).resize(800).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const decoded = jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), info.width, info.height)
  assert.equal(decoded?.data, url)
})
