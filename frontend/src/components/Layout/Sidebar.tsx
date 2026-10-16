/**
 * The leaderboard beside the map.
 *
 * Same row idiom as the ranked table on the front page — rank, city, inline
 * bar, value — so moving between the two doesn't mean learning a second way
 * to read the same data. Narrow enough that the bar is the thing doing the
 * comparing and the number is the thing being read.
 *
 * On large screens it sits next to the map; on small screens the parent grid
 * drops it below.
 */

import { Link } from "react-router-dom";

import { useCurrentAQI, useWorstCities } from "../../hooks/useAQIData";
import {
  formatISTClock,
  formatTimestamp,
  getAQIBand,
} from "../../utils/aqiHelpers";

const SCALE_MAX = 400;
const SHOWN = 10;

export default function Sidebar() {
  const { data, loading, error } = useWorstCities();
  const { data: cities } = useCurrentAQI();

  const entries = data?.entries.slice(0, SHOWN) ?? [];
  const latest = cities?.reduce<string | null>((acc, c) => {
    if (!c.latest_timestamp) return acc;
    return !acc || c.latest_timestamp > acc ? c.latest_timestamp : acc;
  }, null);

  return (
    <aside className="flex h-full flex-col border-t border-smoke-700 bg-smoke-950 md:border-l md:border-t-0">
      <div className="border-b border-smoke-800 px-4 py-3">
        <h2 className="u-label text-smoke-300">Worst right now</h2>
        <p className="mt-1 text-micro text-smoke-500">
          {latest ? (
            <>
              {formatISTClock(latest) ?? "—"} · updated {formatTimestamp(latest)}
            </>
          ) : (
            "Waiting on the first reading."
          )}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error && entries.length === 0 ? (
          <p className="px-4 py-4 font-serif text-body text-smoke-300">{error}</p>
        ) : loading && entries.length === 0 ? (
          <ul aria-hidden>
            {Array.from({ length: SHOWN }).map((_, i) => (
              <li
                key={i}
                className="flex items-center gap-3 border-b border-smoke-800 px-4 py-2.5"
              >
                <span className="skeleton h-3 w-3" />
                <span className="skeleton h-4 flex-1" />
                <span className="skeleton h-4 w-8" />
              </li>
            ))}
          </ul>
        ) : (
          <ol>
            {entries.map((entry, i) => {
              const band = getAQIBand(entry.aqi_value);
              const fraction = Math.min(
                1,
                Math.max(0.02, entry.aqi_value / SCALE_MAX),
              );
              return (
                <li key={entry.city_id} className="border-b border-smoke-800">
                  <Link
                    to={`/cities/${entry.city_id}`}
                    className="group relative block px-4 py-3 transition-colors duration-tap ease-air hover:bg-smoke-900"
                  >
                    <span className="flex items-center gap-3">
                      <span className="u-figure w-4 shrink-0 text-micro text-smoke-500">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body text-smoke-100">
                          {entry.city_name}
                        </span>
                        <span className="block truncate text-micro text-smoke-500">
                          {entry.state}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span
                          className="u-figure block text-row"
                          style={{ color: band.textColor }}
                        >
                          {Math.round(entry.aqi_value)}
                        </span>
                        <span className="block text-[10px] text-smoke-500">
                          {band.label}
                        </span>
                      </span>
                    </span>
                    {/* The bar is the row's own bottom rule — same device as
                        the front-page table at phone width. */}
                    <span className="absolute inset-x-0 bottom-0 block h-[3px] bg-smoke-800">
                      <span
                        className="block h-full origin-left"
                        style={{
                          background: band.color,
                          transform: `scaleX(${fraction})`,
                        }}
                      />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="border-t border-smoke-800 px-4 py-3">
        <Link
          to="/"
          className="group inline-flex items-baseline gap-2 text-micro font-semibold text-smoke-300 transition-colors duration-tap ease-air hover:text-smoke-100"
        >
          All thirty, ranked
          <span
            aria-hidden
            className="text-[color:var(--accent)] transition-transform duration-move ease-air group-hover:translate-x-0.5"
          >
            →
          </span>
        </Link>
      </div>
    </aside>
  );
}
