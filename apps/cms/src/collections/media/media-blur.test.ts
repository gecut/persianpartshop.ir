import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import sharp from 'sharp'
import { BlurCssSchema } from '@persianpart/contract'
import { createBlurCss, blurGridEdge } from './media-blur'

const solid = (width: number, height: number, background: { r: number; g: number; b: number; alpha: number }) =>
  sharp({ create: { width, height, channels: 4, background } }).png().toBuffer()

const rows = (css: { backgroundPosition: string }) => css.backgroundPosition.split(', ').length

describe('createBlurCss', () => {
  it('builds an 8x8 grid for a square image', async () => {
    const css = await createBlurCss(await solid(400, 400, { r: 200, g: 30, b: 30, alpha: 1 }))
    assert.equal(rows(css), blurGridEdge)
    assert.match(css.backgroundImage, /rgb\(200, 30, 30\)/)
    assert.equal(css.backgroundSize, '100% 12.5%')
  })

  it('keeps the aspect ratio of a wide image', async () => {
    const css = await createBlurCss(await solid(1600, 800, { r: 10, g: 20, b: 30, alpha: 1 }))
    assert.equal(rows(css), 4)
    assert.equal(css.backgroundSize, '100% 25%')
  })

  it('keeps the aspect ratio of a tall image', async () => {
    const css = await createBlurCss(await solid(400, 1600, { r: 10, g: 20, b: 30, alpha: 1 }))
    assert.equal(rows(css), blurGridEdge)
    assert.equal(css.backgroundImage.split('linear-gradient').length - 1, blurGridEdge)
    assert.equal(css.backgroundImage.match(/rgb\(/g)?.length, 2 * blurGridEdge)
  })

  it('keeps transparency', async () => {
    const css = await createBlurCss(await solid(64, 64, { r: 255, g: 255, b: 255, alpha: 0 }))
    assert.match(css.backgroundImage, /rgba\(\d+, \d+, \d+, 0\)/)
  })

  it('produces output the public contract accepts', async () => {
    const css = await createBlurCss(await solid(100, 100, { r: 1, g: 2, b: 3, alpha: 1 }))
    assert.equal(BlurCssSchema.safeParse(css).success, true)
  })

  it('rejects a corrupt file instead of returning a placeholder', async () => {
    await assert.rejects(createBlurCss(Buffer.from('not an image')))
  })
})

describe('BlurCssSchema', () => {
  const valid = {
    backgroundImage: 'linear-gradient(90deg, rgb(1, 2, 3) 0% 100%)',
    backgroundPosition: '0 0%',
    backgroundSize: '100% 100%',
    backgroundRepeat: 'no-repeat',
  }
  it('accepts gradient syntax', () => assert.equal(BlurCssSchema.safeParse(valid).success, true))
  it('rejects url() and extra keys', () => {
    assert.equal(BlurCssSchema.safeParse({ ...valid, backgroundImage: 'linear-gradient(url(x))' }).success, false)
    assert.equal(BlurCssSchema.safeParse({ ...valid, backgroundImage: 'url(https://evil.example/x)' }).success, false)
    assert.equal(BlurCssSchema.safeParse({ ...valid, color: 'red' }).success, false)
    assert.equal(BlurCssSchema.safeParse({ ...valid, backgroundSize: '100%; x: y' }).success, false)
  })
})
