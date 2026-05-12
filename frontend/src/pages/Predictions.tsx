/**
 * Aggregate forecast page: ranking-style overview + grid of CityCards.
 */

import { useMemo } from "react";

import CityCard from "../components/Dashboard/CityCard";
import CityRanking from "../components/Dashboard/CityRanking";
import { useCurrentAQI } from "../hooks/useAQIData";
import { useAllPredictions } from "../hooks/usePredictions";

export default function Predictions() {
  const cities = useCurrentAQI();
  const preds = useAllPredictions();

  // Pair each city with its 24h-ahead predicted AQI for the trend arrow.
  const deltasById = useMemo(() => {
    const out = new Map<number, number>();
    if (!preds.data) return out;
    for (const p of preds.data.predictions) {
      if (p.points.length === 0) continue;
      const last = p.points[p.points.length - 1].predicted_aqi;
      const city = cities.data?.find((c) => c.id === p.city_id);
      if (city?.latest_aqi != null) {
        out.set(p.city_id, last - city.latest_aqi);
      }
    }
    return out;
  }, [preds.data, cities.data]);

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto h-full">
      <header>
        <h1 className="text-ink-100 text-2xl font-semibold">24-hour forecasts</h1>
        <p className="text-ink-200 text-sm mt-1">
          Random-Forest predictions for every monitored city. Arrows show the
          delta between now and 24 hours from now.
        </p>
      </header>

      <CityRanking />

      <section>
        <h2 className="text-ink-100 font-semibold mb-3">All cities</h2>
        {cities.loading && !cities.data ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton h-40" />
            ))}
          </div>
        ) : cities.error ? (
          <div className="text-aqi-unhealthy">{cities.error}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {cities.data?.map((city) => (
              <CityCard
                key={city.id}
                city={city}
                trendDelta={deltasById.get(city.id) ?? null}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
