/**
 * Hooks for fetching ML predictions for a single city or all cities.
 *
 * These are the two slowest calls on the site and the two most likely to be
 * met by a sleeping backend: Render's free tier takes ~30s to wake, and a
 * cold forecast cache can take longer still on half a CPU. A single failure
 * therefore means "try again shortly", not "this is broken" — so a failed
 * attempt schedules a bounded retry instead of parking an error on screen
 * until the next ten-minute poll.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchAllPredictions, fetchPrediction } from "../api/client";
import type { AllPredictionsResponse, PredictionResponse } from "../types";

const POLL_MS = 10 * 60 * 1000; // predictions only update on retrain cycles
const RETRY_DELAY_MS = 12_000;
const MAX_RETRIES = 3;

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

  // Pending retry timer, cleared on unmount and before each new attempt so a
  // route change can't leave a timer firing into a dead component.
  const retryTimer = useRef<number | null>(null);
  const attempts = useRef(0);

  const run = useCallback(async (isRetry = false) => {
    if (retryTimer.current) {
      window.clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
    if (!isRetry) attempts.current = 0;

    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fnRef.current();
      attempts.current = 0;
      setState({ data, loading: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      attempts.current += 1;
      const willRetry = attempts.current <= MAX_RETRIES;
      setState({
        data: null,
        // Stay in the loading state while a retry is pending: the page is
        // still waiting on the backend, and saying "failed" for twelve
        // seconds before it works is worse than saying nothing.
        loading: willRetry,
        error: willRetry ? null : message,
      });
      if (willRetry) {
        retryTimer.current = window.setTimeout(() => {
          void run(true);
        }, RETRY_DELAY_MS);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void run();
    const id = pollMs ? window.setInterval(() => void run(), pollMs) : null;
    return () => {
      if (id) window.clearInterval(id);
      if (retryTimer.current) window.clearTimeout(retryTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...state, refetch: () => void run() };
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
