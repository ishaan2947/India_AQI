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
 * which hits the live API and overwrites the JSON files in this
 * directory. The script is best-effort — if it fails, the existing
 * snapshot is kept so the build always succeeds.
 *
 * ---------------------------------------------------------------
 * A note on staleness, because the three files are not alike.
 *
 * Readings describe a moment that *happened*. A six-hour-old reading
 * from Kanpur is still a true statement about Kanpur at that hour, and
 * every surface that shows one also shows its timestamp, so seeding
 * them unconditionally is honest.
 *
 * A forecast describes a moment that *hasn't happened yet*, and it
 * stops being a forecast the instant its horizon slides into the past.
 * Painting yesterday's 24-hour curve under a heading that says "next 24
 * hours" would be the one genuinely dishonest thing on the site. So the
 * forecast snapshot is gated on age and simply declines to seed once it
 * has expired — see freshPredictionsSnapshot().
 */

import type {
  AllPredictionsResponse,
  CityWithLatest,
  PredictionResponse,
  StatsResponse,
} from "../types";

import citiesJson from "./cities-snapshot.json";
import predictionsJson from "./predictions-snapshot.json";
import worstJson from "./worst-snapshot.json";

export const CITIES_SNAPSHOT: CityWithLatest[] =
  citiesJson as unknown as CityWithLatest[];

export const WORST_SNAPSHOT: StatsResponse =
  worstJson as unknown as StatsResponse;

const PREDICTIONS_SNAPSHOT: AllPredictionsResponse =
  predictionsJson as unknown as AllPredictionsResponse;

/**
 * How old a bundled forecast may be and still be worth painting.
 *
 * The forecast covers 24 hours from `generated_at`, so at twelve hours
 * old half the curve is still ahead of the viewer and the page's own
 * "Model run" line tells them exactly how old it is. Past that, the
 * honest thing to show is the skeleton, and the live call — which is
 * already in flight — fills it.
 */
const PREDICTION_SNAPSHOT_MAX_AGE_MS = 12 * 60 * 60 * 1000;

/**
 * The bundled forecast, or null if its horizon has gone stale.
 *
 * Deliberately a function rather than a constant: freshness is a fact
 * about *now*, not about module-evaluation time, and a tab left open
 * overnight must not reseed an expired curve on its next navigation.
 */
export function freshPredictionsSnapshot(): AllPredictionsResponse | null {
  const generatedAt = PREDICTIONS_SNAPSHOT?.generated_at;
  if (!generatedAt) return null;
  if ((PREDICTIONS_SNAPSHOT.predictions?.length ?? 0) === 0) return null;

  // Backend timestamps are naive UTC; parseApiTimestamp's `Z` fix lives in
  // aqiHelpers, but importing it here would drag the whole helper module
  // into every entry point, so do the same normalisation inline.
  const iso = /[Zz]|[+-]\d{2}:?\d{2}$/.test(generatedAt)
    ? generatedAt
    : `${generatedAt}Z`;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;

  const age = Date.now() - ms;
  // A snapshot timestamped in the future means a clock skew somewhere;
  // treat a small skew as fresh and anything wilder as unusable.
  if (age < -60 * 60 * 1000) return null;
  if (age > PREDICTION_SNAPSHOT_MAX_AGE_MS) return null;

  return PREDICTIONS_SNAPSHOT;
}

/** One city's bundled reading, for seeding a city page's masthead. */
export function citySnapshot(cityId: number | null): CityWithLatest | null {
  if (cityId == null) return null;
  return CITIES_SNAPSHOT.find((c) => c.id === cityId) ?? null;
}

/** One city's bundled forecast, if the bundle is still fresh enough. */
export function predictionSnapshot(
  cityId: number | null,
): PredictionResponse | null {
  if (cityId == null) return null;
  const bundle = freshPredictionsSnapshot();
  if (!bundle) return null;
  return bundle.predictions.find((p) => p.city_id === cityId) ?? null;
}
