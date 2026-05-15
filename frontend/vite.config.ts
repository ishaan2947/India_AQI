import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Auto-update means a new deploy is fetched on next visit without
      // showing the user a confirm dialog. Right call for a public dashboard
      // — they don't need to know we shipped.
      registerType: "autoUpdate",
      // Keep the service worker disabled during `vite dev` so local
      // development doesn't trip over stale caches.
      devOptions: { enabled: false },
      includeAssets: [
        "favicon.svg",
        "favicon.ico",
        "apple-touch-icon-180x180.png",
        "logo.svg",
      ],
      manifest: {
        name: "AQI India Intelligence",
        short_name: "AQI India",
        description:
          "Real-time air quality monitoring and 24-hour ML forecasts for 30 Indian cities.",
        theme_color: "#0b1220",
        background_color: "#0b1220",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        scope: "/",
        categories: ["health", "weather", "utilities"],
        icons: [
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        // Don't precache the giant charts bundle if user never visits a
        // chart page (chunks are split — vendor bundles are demanded
        // by routes that need them).
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Force the new service worker to activate immediately on next
        // page load (rather than waiting for all open tabs to close)
        // and take control of currently-open pages.
        skipWaiting: true,
        clientsClaim: true,
        // Nuke any caches from older SW versions so stale data doesn't
        // outlive a deploy.
        cleanupOutdatedCaches: true,
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          // AQI backend — StaleWhileRevalidate. Returns the cached
          // response INSTANTLY (no waiting on Render to cold-start),
          // then silently fetches fresh data in the background and
          // updates the cache for next time. The user always sees a
          // populated dashboard, never a spinner-then-error.
          //
          // AQI doesn't change second-by-second, so showing 5-15 min
          // old data while fresh data loads is the right trade-off.
          // Acceptable for /cities, /aqi/current, /stats/*. The
          // /predictions endpoint changes only nightly so it's even
          // happier with this strategy.
          {
            urlPattern: ({ url }) =>
              url.origin === "https://aqi-india-api.onrender.com" &&
              url.pathname.startsWith("/api/"),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "aqi-api-cache",
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 24 * 60 * 60, // 24h max — stale-but-shown
              },
              cacheableResponse: { statuses: [0, 200] },
              // Broadcast cache updates so React can re-render when
              // fresh data lands (handled by vite-plugin-pwa default).
              broadcastUpdate: {
                channelName: "aqi-api-updates",
                options: { headersToCheck: ["content-length", "etag"] },
              },
            },
          },
          // CARTO dark map tiles — Cache first, they basically never
          // change so caching aggressively saves a *lot* of bandwidth.
          {
            urlPattern: /^https:\/\/[a-d]\.basemaps\.cartocdn\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "map-tile-cache",
              expiration: {
                maxEntries: 300,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Google Fonts CSS — Stale While Revalidate so we serve from
          // cache instantly but fetch the latest in the background.
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "google-fonts-stylesheets",
              expiration: { maxAgeSeconds: 7 * 24 * 60 * 60 }, // 7 days
            },
          },
          // Google Fonts woff2 files — Cache first, they're immutable.
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "leaflet-vendor": ["leaflet", "react-leaflet"],
          "charts-vendor": ["recharts"],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
