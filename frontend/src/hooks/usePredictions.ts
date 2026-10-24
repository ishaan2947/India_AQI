/**
 * Hooks for fetching ML predictions for a single city or all cities.
 *
 * These are the two slowest calls on the site and the two most likely to be
 * met by a sleeping backend: Render's free tier takes ~30s to wake, and a
 * cold forecast cache can take longer still on half a CPU. A single failure
 * therefore means "try again shortly", not "this is broken" — so a failed
 * attempt schedules a bounded retry instead of parking an error on screen
 * until the next ten-minute poll.
 *
 * And because thirty seconds of skeleton is a bad first impression however
 * well-behaved the retry is, both hooks seed from the forecast snapshot
 * baked into the bundle at build time (see ../data/snapshot.ts). The live
 * call still fires immediately and overwrites the seed the moment it lands;
 * the seed only decides what the visitor looks at in the meantime. It
 * expires — a forecast whose horizon has passed declines to seed at all.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fetchAllPredictions, fetchPrediction } from "../api/client";
import { freshPredictionsSnapshot, predictionSnapshot } from "../data/snapshot";
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
  seed: T | null = null,
): AsyncState<T> & { refetch: () => void } {
  const [state, setState] = useState<AsyncState<T>>(() => ({
    data: seed,
    // Seeded means paintable, and a page that can paint should not be
    // showing a spinner. The refresh happens quietly underneath.
    loading: seed == null,
    error: null,
  }));
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const seedRef = useRef(seed);
  seedRef.current = seed;

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

    // Only claim to be loading if there is nothing on screen yet.
    setState((s) => ({ ...s, loading: s.data == null, error: null }));
    try {
      const data = await fnRef.current();
      attempts.current = 0;
      setState({ data, loading: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      attempts.current += 1;
      const willRetry = attempts.current <= MAX_RETRIES;
      setState((s) => ({
        // Hold on to whatever we were already showing — the bundled seed or
        // a previous success — rather than blanking a populated page because
        // one request lost a race with a cold dyno.
        data: s.data,
        // Stay in the loading state while a retry is pending *and* we have
        // nothing to show: saying "failed" for twelve seconds before it
        // works is worse than saying nothing.
        loading: s.data == null && willRetry,
        // Only surface an error if we have exhausted the retries and have
        // nothing to fall back on.
        error: s.data == null && !willRetry ? message : null,
      }));
      if (willRetry) {
        retryTimer.current = window.setTimeout(() => {
          void run(true);
        }, RETRY_DELAY_MS);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Deps changing means a different subject (a different city), so the
    // data on screen belongs to the previous one. Drop back to the new
    // subject's seed rather than showing city A's forecast under city B's
    // name while the fetch is in flight.
    setState({
      data: seedRef.current,
      loading: seedRef.current == null,
      error: null,
    });
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
  const seed = useMemo(() => predictionSnapshot(cityId), [cityId]);
  return useAsync<PredictionResponse | null>(
    () => (cityId == null ? Promise.resolve(null) : fetchPrediction(cityId)),
    [cityId],
    POLL_MS,
    seed,
  );
}

export function useAllPredictions() {
  const seed = useMemo(() => freshPredictionsSnapshot(), []);
  return useAsync<AllPredictionsResponse>(
    () => fetchAllPredictions(),
    [],
    POLL_MS,
    seed,
  );
}
