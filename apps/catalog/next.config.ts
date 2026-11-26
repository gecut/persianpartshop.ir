import type { NextConfig } from 'next'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const config: NextConfig = {
  agentRules: false,
  output: 'standalone',
  outputFileTracingRoot: root,
  turbopack: { root },
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex' }] }]
  },
  htmlLimitedBots: /.*/,
  images: { unoptimized: true },
  transpilePackages: ['@persianpart/contract'],
  async rewrites() {
    return [{ source: '/Q/:token', destination: '/q/:token' }]
  },
}
export default config
