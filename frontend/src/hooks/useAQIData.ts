/**
 * Hooks for fetching AQI-related data. They handle loading, error, and
 * polling so components stay declarative.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchCityHistory,
  fetchCurrentAQI,
  fetchWorst,
} from "../api/client";
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
): AsyncState<T> & { refetch: () => void } {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fnRef.current();
      setState({ data, loading: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setState({ data: null, loading: false, error: message });
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
  return useAsync<CityWithLatest[]>(() => fetchCurrentAQI(), [], pollMs);
}

export function useCityHistory(cityId: number | null, hours = 24) {
  return useAsync<AQIReading[]>(
    () => (cityId == null ? Promise.resolve([]) : fetchCityHistory(cityId, hours)),
    [cityId, hours],
    DEFAULT_REFRESH_MS,
  );
}

export function useWorstCities(pollMs = DEFAULT_REFRESH_MS) {
  return useAsync<StatsResponse>(() => fetchWorst(), [], pollMs);
}
