#!/usr/bin/env node
/**
 * Refresh the static fallback snapshot at build time.
 *
 * Run automatically by `npm run prebuild` (which Vite / Vercel both
 * invoke before `npm run build`). Best-effort: if the API is down at
 * build time, the previous snapshot is kept so the build never fails.
 *
 * Why the static snapshot exists: the UI seeds its initial state from
 * these JSON files so a first-time visitor with no SW cache and a cold
 * Render dyno never sees an empty dashboard. The real API call still
 * fires in the background and replaces this data once it lands.
 */

import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "..", "src", "data");

const API_BASE = "https://aqi-india-api.onrender.com";
const TIMEOUT_MS = 60_000; // 60s — generous for Render cold starts

const endpoints = [
  { url: `${API_BASE}/api/cities`, file: "cities-snapshot.json" },
  { url: `${API_BASE}/api/stats/worst`, file: "worst-snapshot.json" },
];

async function fetchWithTimeout(url, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  for (const { url, file } of endpoints) {
    const path = resolve(DATA_DIR, file);
    try {
      console.log(`[snapshot] fetching ${url}`);
      const data = await fetchWithTimeout(url, TIMEOUT_MS);
      writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
      console.log(`[snapshot] wrote ${file}`);
    } catch (err) {
      console.warn(
        `[snapshot] FAILED ${url}: ${err.message}. Keeping existing ${file}.`,
      );
    }
  }
}

main().catch((err) => {
  console.warn(`[snapshot] unexpected error: ${err.message}`);
  // Never fail the build — old snapshot is acceptable.
  process.exit(0);
});
