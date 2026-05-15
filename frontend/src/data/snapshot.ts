/**
 * Static fallback data baked into the bundle at build time.
 *
 * Purpose: the UI should *never* render an empty / "Network Error"
 * state. Even on the very first visit before the service-worker cache
 * exists, or in the unlikely event the backend is briefly unreachable,
 * we instantly paint these readings and then let the real API call
 * silently replace them.
 *
 * Refreshed by the `prebuild` npm script (see package.json):
 *    npm run snapshot
 * which hits the live API and overwrites the two JSON files in this
 * directory. The script is best-effort — if it fails, the existing
 * snapshot is kept so the build always succeeds.
 */

import type { CityWithLatest, StatsResponse } from "../types";

import citiesJson from "./cities-snapshot.json";
import worstJson from "./worst-snapshot.json";

export const CITIES_SNAPSHOT: CityWithLatest[] =
  citiesJson as unknown as CityWithLatest[];

export const WORST_SNAPSHOT: StatsResponse =
  worstJson as unknown as StatsResponse;
