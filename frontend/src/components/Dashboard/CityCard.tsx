/**
 * Compact summary card for a single city: name, AQI, category badge,
 * PM2.5, and a 6h trend arrow.
 */

import { Link } from "react-router-dom";

import type { CityWithLatest } from "../../types";
import {
  formatTimestamp,
  getAQICategory,
  getAQIColor,
} from "../../utils/aqiHelpers";

interface CityCardProps {
  city: CityWithLatest;
  trendDelta?: number | null;
}

export default function CityCard({ city, trendDelta }: CityCardProps) {
  const aqi = city.latest_aqi;
  const color = aqi != null ? getAQIColor(aqi) : "#475569";
  const category = aqi != null ? getAQICategory(aqi) : "No data";

  const trendIcon = (() => {
    if (trendDelta == null) return null;
    if (Math.abs(trendDelta) < 3) return "→";
    return trendDelta > 0 ? "↑" : "↓";
  })();

  const trendColor = (() => {
    if (trendDelta == null) return "text-ink-200";
    if (Math.abs(trendDelta) < 3) return "text-ink-200";
    return trendDelta > 0 ? "text-aqi-unhealthy" : "text-aqi-good";
  })();

  return (
    <Link
      to={`/cities/${city.id}`}
      className="block bg-ink-800 border border-ink-700 hover:border-ink-600 rounded-xl p-4 transition shadow-md"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-ink-100 font-semibold">{city.name}</div>
          <div className="text-xs text-ink-200">{city.state}</div>
        </div>
        {trendIcon ? (
          <div className={`text-lg font-bold ${trendColor}`} title="vs 6h ago">
            {trendIcon}
            {trendDelta != null ? (
              <span className="ml-1 text-xs">{Math.abs(trendDelta).toFixed(0)}</span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex items-baseline gap-3">
        <div className="text-3xl font-bold" style={{ color }}>
          {aqi != null ? Math.round(aqi) : "—"}
        </div>
        <div
          className="text-[11px] font-medium px-2 py-1 rounded"
          style={{ background: `${color}22`, color }}
        >
          {category}
        </div>
      </div>

      <div className="mt-3 text-xs text-ink-200">
        PM2.5: {city.latest_pm25?.toFixed(1) ?? "—"} µg/m³
      </div>
      <div className="text-[11px] text-ink-200/80 mt-1">
        Updated {formatTimestamp(city.latest_timestamp)}
      </div>
    </Link>
  );
}
