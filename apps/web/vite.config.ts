import { defineConfig, loadEnv } from "vite";
import { randomUUID } from "node:crypto";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import { fileURLToPath, URL } from "node:url";

import fs from "node:fs";
import path from "node:path";

// Dev middleware to serve CMS media files directly or fallback
function devMediaPlugin() {
  const mimeTypes: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".gif": "image/gif",
  };

  return {
    name: "dev-media-server",
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        if (!req.url || !req.url.startsWith("/api/media")) {
          return next();
        }

        try {
          const urlObj = new URL(req.url, "http://localhost");
          const pathname = decodeURIComponent(urlObj.pathname);
          const parts = pathname.split("/");
          const filename = parts[parts.length - 1];

          if (!filename) return next();

          const candidateDirs = [
            fileURLToPath(new URL("../cms/media", import.meta.url)),
            fileURLToPath(new URL("./public/api/media/file", import.meta.url)),
            fileURLToPath(new URL("./public/assets/images", import.meta.url)),
          ];

          const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();

          for (const dir of candidateDirs) {
            const fullPath = path.join(dir, filename);
            if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
              res.setHeader(
                "Content-Type",
                mimeTypes[ext] || "application/octet-stream",
              );
              res.setHeader(
                "Cache-Control",
                "public, max-age=31536000, immutable",
              );
              res.setHeader("Access-Control-Allow-Origin", "*");
              fs.createReadStream(fullPath).pipe(res);
              return;
            }
          }
        } catch {
          // Fall through to proxy
        }

        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  cacheDir: process.env.VITE_CACHE_DIR || 'node_modules/.vite',
  plugins: [
    TanStackRouterVite({
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.ts",
    }),
    react(),
    tailwindcss(),
    devMediaPlugin(),
    VitePWA({
      strategies: 'injectManifest', srcDir: 'src', filename: 'sw.ts',
      registerType: 'prompt', injectRegister: false,
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'پرشین‌پارت', short_name: 'پرشین‌پارت', lang: 'fa', dir: 'rtl',
        id: '/', scope: '/', start_url: '/product', display: 'standalone',
        theme_color: '#ffffff', background_color: '#ffffff',
        icons: [
          { src: '/favicon.ico', sizes: '16x16 32x32', type: 'image/x-icon' },
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: [
          'index.html', 'assets/**/*.{js,css,woff2}', 'assets/images/persian-part-logo.png',
          'assets/images/zamanian-logo-mask.png', 'assets/images/placeholder.svg',
        ],
        globIgnores: ['**/*wasm*', '**/*qr-*'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // A revision makes Workbox fetch with cache: 'reload', including hashed assets.
        dontCacheBustURLsMatching: undefined,
        buildPlugins: {
          vite: [{
            name: 'persianpart-worker-config',
            config() {
              const env = loadEnv(mode, process.cwd(), 'VITE_')
              return {
                define: {
                  __PWA_RELEASE__: JSON.stringify(randomUUID()),
                  __PWA_CDN_ORIGIN__: JSON.stringify(new URL(env.VITE_CDN_URL || 'https://cdn.persianpart.shop').origin),
                },
              }
            },
          }],
        },
      },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ["@persianpart/api", "@persianpart/contract"],
    include: [
      "@orpc/client",
      "@orpc/client/fetch",
      "@tanstack/react-query",
      "@tanstack/react-router",
      "@heroui/react",
      "framer-motion",
    ],
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: true,
    proxy: {
      "/api/media": {
        target: "https://cdn.beta.persianpartshop.ir",
        changeOrigin: true,
      },
      "/api": {
        target: "https://api.beta.persianpartshop.ir",
        changeOrigin: true,
      },
    },
  },
}));
