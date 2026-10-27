import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import { fileURLToPath, URL } from 'node:url'

import fs from 'node:fs'
import path from 'node:path'

// Dev middleware to serve CMS media files directly or fallback
function devMediaPlugin() {
  const mimeTypes: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.gif': 'image/gif',
  }

  return {
    name: 'dev-media-server',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        if (!req.url || !req.url.startsWith('/api/media')) {
          return next()
        }

        try {
          const urlObj = new URL(req.url, 'http://localhost')
          const pathname = decodeURIComponent(urlObj.pathname)
          const parts = pathname.split('/')
          const filename = parts[parts.length - 1]

          if (!filename) return next()

          const candidateDirs = [
            fileURLToPath(new URL('../cms/media', import.meta.url)),
            fileURLToPath(new URL('./public/api/media/file', import.meta.url)),
            fileURLToPath(new URL('./public/assets/images', import.meta.url)),
          ]

          const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase()

          for (const dir of candidateDirs) {
            const fullPath = path.join(dir, filename)
            if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
              res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream')
              res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
              res.setHeader('Access-Control-Allow-Origin', '*')
              fs.createReadStream(fullPath).pipe(res)
              return
            }
          }
        } catch {
          // Fall through to proxy
        }

        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    TanStackRouterVite({
      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts',
    }),
    react(),
    tailwindcss(),
    devMediaPlugin(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['@persianpart/api', '@persianpart/contract'],
    include: [
      '@orpc/client',
      '@orpc/client/fetch',
      '@tanstack/react-query',
      '@tanstack/react-router',
      '@heroui/react',
      'framer-motion',
    ],
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api/media': {
        target: 'http://localhost:5175',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:5175',
        changeOrigin: true,
      },
    },
  },
})
