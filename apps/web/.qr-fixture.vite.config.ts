import { createHmac } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { defineConfig, mergeConfig } from 'vite'
import base from './vite.config'

function token() {
  const encoded = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const input = `${encoded({ alg: 'HS256', typ: 'JWT' })}.${encoded({ sub: '1', role: 'customer', iss: 'persianpart.shop', aud: 'persianpart-client', iat: now, exp: now + 3600 })}`
  return `${input}.${createHmac('sha256', 'local-test-only-jwt-secret-012345678901234567890').update(input).digest('base64url')}`
}

export default mergeConfig(base, defineConfig({
  plugins: [{
    name: 'local-qr-fixture',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/fixture-qr.png') {
          res.setHeader('Content-Type', 'image/png')
          res.end(await readFile(fileURLToPath(new URL('./e2e/fixtures/product-qr.png', import.meta.url))))
          return
        }
        if (req.url !== '/fixture-login') return next()
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        res.end(`<script>localStorage.setItem('persianpart_token', ${JSON.stringify(token())}); localStorage.setItem('persianpart_auth', JSON.stringify({user:{id:'1',name:'Tester',canUseProductQr:true}})); location.replace('/product')</script>`)
      })
    },
  }],
  server: { host: '0.0.0.0', port: 55176, strictPort: true, proxy: { '/api': { target: 'http://127.0.0.1:55175', changeOrigin: true }, '/api/media': { target: 'http://127.0.0.1:55175', changeOrigin: true } } },
}))
