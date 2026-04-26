/**
 * Hook for fetching ML predictions for a single city or all cities.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchAllPredictions, fetchPrediction } from "../api/client";
import type { AllPredictionsResponse, PredictionResponse } from "../types";

const POLL_MS = 10 * 60 * 1000; // predictions only update on retrain cycles

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

export function useCityPrediction(cityId: number | null) {
  return useAsync<PredictionResponse | null>(
    () => (cityId == null ? Promise.resolve(null) : fetchPrediction(cityId)),
    [cityId],
    POLL_MS,
  );
}

export function useAllPredictions() {
  return useAsync<AllPredictionsResponse>(() => fetchAllPredictions(), [], POLL_MS);
}
