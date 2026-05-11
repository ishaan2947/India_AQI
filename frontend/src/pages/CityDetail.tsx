/**
 * Per-city deep-dive: current snapshot card, 24h trend, and 24h forecast.
 */

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import CityCard from "../components/Dashboard/CityCard";
import PredictionPanel from "../components/Dashboard/PredictionPanel";
import TrendChart from "../components/Dashboard/TrendChart";
import { fetchCity, fetchCityHistory } from "../api/client";
import type { CityWithLatest } from "../types";
import { getAQIAdvice, getAQIColor } from "../utils/aqiHelpers";

export default function CityDetail() {
  const { cityId } = useParams<{ cityId: string }>();
  const id = cityId ? Number(cityId) : null;

  const [city, setCity] = useState<CityWithLatest | null>(null);
  const [trendDelta, setTrendDelta] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id == null) return;
    let cancelled = false;
    (async () => {
      try {
        const [c, hist] = await Promise.all([
          fetchCity(id),
          fetchCityHistory(id, 8),
        ]);
        if (cancelled) return;
        setCity(c);
        // Compare current value with the reading ≈6h ago.
        if (hist.length >= 2 && c.latest_aqi != null) {
          const older = hist[0].aqi_value;
          setTrendDelta(c.latest_aqi - older);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load city");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (id == null) {
    return <div className="p-6 text-ink-200">Invalid city id.</div>;
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <Link to="/" className="text-sm text-ink-200 hover:text-ink-100">
        ← Back to map
      </Link>

      {error ? (
        <div className="text-aqi-unhealthy">{error}</div>
      ) : !city ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="skeleton h-40" />
          <div className="skeleton h-40 md:col-span-2" />
        </div>
      ) : (
        <>
          {city.latest_aqi != null ? (
            <div
              className="flex items-start gap-3 border-l-4 rounded-r-md bg-ink-800/70 px-4 py-3"
              style={{ borderColor: getAQIColor(city.latest_aqi) }}
            >
              <span className="text-[11px] uppercase tracking-wider text-ink-200/80 mt-0.5 shrink-0">
                Today
              </span>
              <p className="text-sm text-ink-100 leading-snug">
                {getAQIAdvice(city.latest_aqi)}
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <CityCard city={city} trendDelta={trendDelta} />
            <div className="md:col-span-2">
              <TrendChart cityId={city.id} cityName={city.name} />
            </div>
          </div>

          <PredictionPanel city={city} />
        </>
      )}
    </div>
  );
}
