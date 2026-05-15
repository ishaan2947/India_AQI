/**
 * Hooks for fetching AQI-related data. They handle loading, error, and
 * polling so components stay declarative.
 *
 * `useCurrentAQI` and `useWorstCities` seed their initial state with a
 * static snapshot baked into the bundle (see ../data/snapshot.ts), so
 * the UI never paints empty even on the very first visit before the
 * service-worker cache exists. The real API call still fires in the
 * background and replaces the snapshot when it lands.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchCityHistory,
  fetchCurrentAQI,
  fetchWorst,
} from "../api/client";
import { CITIES_SNAPSHOT, WORST_SNAPSHOT } from "../data/snapshot";
import type { AQIReading, CityWithLatest, StatsResponse } from "../types";

const DEFAULT_REFRESH_MS = 5 * 60 * 1000; // 5 minutes

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

function useAsync<T>(
  fn: () => Promise<T>,
  deps: ReadonlyArray<unknown>,
  pollMs?: number,
  initialData: T | null = null,
): AsyncState<T> & { refetch: () => void } {
  const [state, setState] = useState<AsyncState<T>>({
    data: initialData,
    // If we already have seed data, the dashboard is paintable —
    // don't show a spinner, just refresh quietly.
    loading: initialData == null,
    error: null,
  });

  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async () => {
    setState((s) => ({ ...s, loading: s.data == null, error: null }));
    try {
      const data = await fnRef.current();
      setState({ data, loading: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setState((s) => ({
        // Keep whatever we were already showing (snapshot or previous
        // successful fetch) rather than blanking the UI on a network blip.
        data: s.data,
        loading: false,
        // Only surface the error if we have nothing to show at all.
        error: s.data == null ? message : null,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    run();
    if (!pollMs) return;
    const id = window.setInterval(run, pollMs);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...state, refetch: run };
}

export function useCurrentAQI(pollMs = DEFAULT_REFRESH_MS) {
  return useAsync<CityWithLatest[]>(
    () => fetchCurrentAQI(),
    [],
    pollMs,
    CITIES_SNAPSHOT,
  );
}

export function useCityHistory(cityId: number | null, hours = 24) {
  return useAsync<AQIReading[]>(
    () => (cityId == null ? Promise.resolve([]) : fetchCityHistory(cityId, hours)),
    [cityId, hours],
    DEFAULT_REFRESH_MS,
  );
}

export function useWorstCities(pollMs = DEFAULT_REFRESH_MS) {
  return useAsync<StatsResponse>(
    () => fetchWorst(),
    [],
    pollMs,
    WORST_SNAPSHOT,
  );
}
