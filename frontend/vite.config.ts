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
        runtimeCaching: [
          // Our backend API — Network first so data stays fresh, but
          // fall back to the cached response if the network is slow or
          // the user is offline. 8s timeout balances fresh-vs-fast.
          {
            urlPattern: ({ url }) =>
              url.origin === "https://aqi-india-api.onrender.com",
            handler: "NetworkFirst",
            options: {
              cacheName: "aqi-api-cache",
              networkTimeoutSeconds: 8,
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 5 * 60, // 5 minutes
              },
              cacheableResponse: { statuses: [0, 200] },
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
