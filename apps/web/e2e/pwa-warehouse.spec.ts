import { test, expect } from '@playwright/test'
import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

test('existing warehouse regression scenario remains valid', async ({ page }) => {
  test.setTimeout(90_000)
  const socket = createServer()
  await new Promise<void>(resolve => socket.listen(0, '127.0.0.1', resolve))
  const address = socket.address()
  if (!address || typeof address === 'string') throw new Error('Missing test port')
  const port = String(address.port)
  await new Promise<void>(resolve => socket.close(() => resolve()))
  const origin = `http://127.0.0.1:${port}`
  const server = spawn('pnpm', ['--filter', '@persianpart/web', 'dev', '--port', port, '--strictPort'], { cwd: resolve('../..'), detached: true, stdio: 'ignore', env: { ...process.env, VITE_CACHE_DIR: 'node_modules/.vite-pwa-regression' } })
  try {
    await expect.poll(async () => {
      try { return (await fetch(origin)).ok } catch { return false }
    }, { timeout: 25_000 }).toBe(true)
    await page.goto(origin + '/login')
    await page.getByRole('heading', { name: 'ورود به پرشین‌پارت' }).waitFor()
    await page.waitForLoadState('networkidle')
    const source = (await readFile(resolve('e2e/warehouse.js'), 'utf8')).replaceAll('55173', port)
    const scenario = new Function(`return (${source})`)() as (page: import('@playwright/test').Page) => Promise<void>
    await scenario(page)
  } finally {
    if (server.pid) { try { process.kill(-server.pid, 'SIGTERM') } catch { /* Process already exited. */ } }
  }
})
