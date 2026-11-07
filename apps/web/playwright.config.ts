import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e', testMatch: 'pwa*.spec.ts', fullyParallel: false,
  timeout: 30_000, expect: { timeout: 8_000 },
  use: { baseURL: 'http://127.0.0.1:4173', browserName: 'chromium', channel: process.env.PWA_BROWSER_CHANNEL, viewport: { width: 390, height: 844 }, trace: 'retain-on-failure' },
  webServer: { command: 'pnpm preview --host 127.0.0.1 --port 4173 --strictPort', url: 'http://127.0.0.1:4173', reuseExistingServer: false },
})
