import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
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
    // Split heavy vendor libs into their own chunks so the initial page-load
    // bundle stays small. Each chunk caches independently, so a code-only
    // deploy doesn't bust the user's leaflet/recharts cache.
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
