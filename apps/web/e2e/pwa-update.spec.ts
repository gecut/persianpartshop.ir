import { test, expect } from '@playwright/test'
import { createServer } from 'node:http'
import { cp, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, extname, resolve } from 'node:path'
import { generateSW } from 'workbox-build'

// A separate origin serves two real precache revisions; no mocked worker lifecycle.
test('waiting worker updates only on user action and preserves the draft', async ({ browser }) => {
  test.setTimeout(60_000)
  const temporary = await mkdtemp(join(tmpdir(), 'persianpart-pwa-'))
  const first = join(temporary, 'first'), second = join(temporary, 'second')
  await cp(resolve('dist'), first, { recursive: true })
  await cp(first, second, { recursive: true })
  await writeFile(join(second, 'index.html'), (await readFile(join(second, 'index.html'), 'utf8')).replace('</head>', '<meta name="pwa-test-version" content="second"></head>'))
  await generateSW({ globDirectory: second, swDest: join(second, 'sw.js'), globPatterns: ['index.html', 'assets/**/*.{js,css,woff2}', 'pwa-*.png'], maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, navigateFallback: '/index.html', cleanupOutdatedCaches: true })
  let current = first
  const mime: Record<string, string> = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.png': 'image/png' }
  const server = createServer(async (request, response) => {
    const url = new URL(request.url!, 'http://localhost')
    const filename = extname(url.pathname) ? url.pathname : '/index.html'
    try {
      const body = await readFile(join(current, filename))
      response.writeHead(200, { 'Content-Type': mime[extname(filename)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' }); response.end(body)
    } catch { response.writeHead(404); response.end() }
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('No fixture port')
  const origin = `http://127.0.0.1:${address.port}`
  const context = await browser.newContext()
  try {
    await context.addInitScript(() => {
      if (!localStorage.getItem('persianpart_token')) {
        localStorage.setItem('persianpart_token', 'fixture')
        localStorage.setItem('persianpart_auth', JSON.stringify({ isAuthenticated: true, user: { id: '1', name: 'تست', storeName: 'تست' } }))
      }
    })
    await context.route('**/api/rpc/**', route => route.fulfill({ json: { json: route.request().url().includes('auth/session') ? { user: { id: '1' } } : route.request().url().includes('user/profile') ? { id: '1', fullName: 'تست', companyName: 'تست' } : { items: [] } } }))
    const page = await context.newPage()
    await page.goto(origin + '/account')
    await page.evaluate(async () => { await navigator.serviceWorker.ready })
    await page.reload()
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
    await page.getByRole('button', { name: /ویرایش/ }).first().click()
    await page.locator('input').filter({ visible: true }).first().fill('پیش‌نویس قبل از آپدیت')
    await expect.poll(() => page.evaluate(() => localStorage.getItem('persianpart_text_v1:1:profile'))).toContain('پیش‌نویس قبل از آپدیت')
    // Closing a form without cancel is represented by navigating away, which keeps its draft.
    await page.goto(origin + '/account')
    current = second
    await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())?.update() })
    await expect(page.getByRole('button', { name: 'مشاهدهٔ بروزرسانی' })).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('meta[name="pwa-test-version"]')).toHaveCount(0)
    await page.getByRole('button', { name: 'بعداً', exact: true }).click()
    await expect(page.getByRole('button', { name: 'مشاهدهٔ بروزرسانی' })).toHaveCount(0)
    await page.getByRole('button', { name: 'نصب و بروزرسانی برنامه' }).click()
    await expect(page.getByRole('heading', { name: 'بروزرسانی پرشین‌پارت' })).toBeVisible()
    await page.getByRole('button', { name: 'بروزرسانی اکنون' }).click()
    await expect(page.locator('meta[name="pwa-test-version"]')).toHaveAttribute('content', 'second', { timeout: 20_000 })
    await page.getByRole('button', { name: /ویرایش/ }).first().click()
    await expect(page.locator('input').filter({ visible: true }).first()).toHaveValue('پیش‌نویس قبل از آپدیت')
  } finally {
    await context.close()
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    await rm(temporary, { recursive: true, force: true })
  }
})
