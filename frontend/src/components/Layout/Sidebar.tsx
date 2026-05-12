/**
 * Right-hand sidebar showing the live "most polluted" leaderboard.
 *
 * On large screens it's rendered next to the map; on small screens it
 * collapses below it (handled by the parent's grid layout).
 */

import { Link } from "react-router-dom";

import { useWorstCities } from "../../hooks/useAQIData";
import { getAQIColor } from "../../utils/aqiHelpers";

export default function Sidebar() {
  const { data, loading, error } = useWorstCities();

  return (
    <aside className="bg-ink-800 border-t md:border-t-0 md:border-l border-ink-700 px-3 sm:px-4 pt-2 sm:pt-4 pb-3 overflow-y-auto h-full">
      <div className="flex items-baseline justify-between mb-1.5 sm:mb-3">
        <h2 className="text-ink-100 font-semibold tracking-tight text-sm sm:text-base">
          Live leaderboard
        </h2>
        <span className="text-[10px] sm:text-xs text-ink-200/60">Top 10</span>
      </div>

      {loading && !data ? (
        <div className="space-y-1.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-8 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="text-aqi-unhealthy text-sm">{error}</div>
      ) : (
        <ol className="space-y-1">
          {data?.entries.slice(0, 10).map((entry, idx) => {
            const color = getAQIColor(entry.aqi_value);
            return (
              <li key={entry.city_id}>
                <Link
                  to={`/cities/${entry.city_id}`}
                  className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-ink-700 transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-ink-200/60 text-[11px] font-mono tabular-nums w-4 text-right">
                      {idx + 1}
                    </span>
                    <span className="text-ink-100 text-sm font-medium truncate">
                      {entry.city_name}
                    </span>
                  </div>
                  <span
                    className="text-sm font-bold font-mono tabular-nums shrink-0"
                    style={{ color }}
                  >
                    {Math.round(entry.aqi_value)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </aside>
  );
}
