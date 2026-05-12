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
    <aside className="bg-ink-800 border-t md:border-t-0 md:border-l border-ink-700 p-4 overflow-y-auto h-full">
      <h2 className="text-ink-100 font-semibold mb-1">Live leaderboard</h2>
      <p className="text-xs text-ink-200 mb-4">Most polluted cities right now.</p>

      {loading && !data ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-9 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="text-aqi-unhealthy text-sm">{error}</div>
      ) : (
        <ol className="space-y-2">
          {data?.entries.slice(0, 10).map((entry, idx) => {
            const color = getAQIColor(entry.aqi_value);
            return (
              <li key={entry.city_id}>
                <Link
                  to={`/cities/${entry.city_id}`}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-md hover:bg-ink-700 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-ink-200 text-xs w-4">{idx + 1}.</span>
                    <span className="text-ink-100 text-sm font-medium">
                      {entry.city_name}
                    </span>
                  </div>
                  <span
                    className="text-sm font-bold font-mono tabular-nums"
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
