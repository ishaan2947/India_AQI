/**
 * Full-width interactive Leaflet map centred on India.
 *
 * Renders one circular, AQI-coloured marker per monitored city. The
 * highest-AQI city gets a subtle CSS pulse so the eye is drawn to the
 * current hotspot. Auto-refreshes every 5 minutes.
 *
 * Clicking a marker opens its popup (with a "View detail" link inside);
 * we deliberately avoid auto-navigating away so the user can keep
 * exploring the map without losing context.
 */

import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer } from "react-leaflet";

import { useCurrentAQI } from "../../hooks/useAQIData";
import { getAllCategories } from "../../utils/aqiHelpers";
import AQIMarker from "./AQIMarker";

const INDIA_CENTER: [number, number] = [22.5, 80.0];
const INITIAL_ZOOM = 5;

export default function AQIMap() {
  const { data, loading, error } = useCurrentAQI();

  const worstCityId = useMemo(() => {
    if (!data) return null;
    let worst: { id: number; aqi: number } | null = null;
    for (const city of data) {
      if (city.latest_aqi == null) continue;
      if (!worst || city.latest_aqi > worst.aqi) {
        worst = { id: city.id, aqi: city.latest_aqi };
      }
    }
    return worst?.id ?? null;
  }, [data]);

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={INDIA_CENTER}
        zoom={INITIAL_ZOOM}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &middot; &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
        />
        {data?.map((city) => (
          <AQIMarker
            key={city.id}
            city={city}
            isWorst={city.id === worstCityId}
          />
        ))}
      </MapContainer>

      {loading && !data ? (
        <ColdStartOverlay />
      ) : null}

      {error ? (
        <div className="absolute top-4 left-4 z-[1000] bg-aqi-unhealthy/90 text-white text-sm px-3 py-2 rounded shadow max-w-md">
          {error}
        </div>
      ) : null}

      <Legend />
    </div>
  );
}

/**
 * Shown only when we have no data yet. Free-tier Render takes ~30–60s to
 * wake from sleep — leave the user a hint so the loader doesn't feel broken.
 */
function ColdStartOverlay() {
  const [showHint, setShowHint] = useState(false);
  // After 4 s of waiting, surface the "waking up" hint.
  useEffect(() => {
    const t = window.setTimeout(() => setShowHint(true), 4000);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-ink-900/65 pointer-events-none">
      <div className="text-center">
        <div className="skeleton h-9 w-56 mx-auto" />
        {showHint ? (
          <div className="text-ink-200 text-xs mt-3 max-w-xs leading-relaxed">
            Waking the backend… first request after long idle takes ~30s on the
            free tier.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Legend() {
  const categories = getAllCategories();
  return (
    <div className="absolute bottom-4 right-4 z-[1000] bg-ink-800/95 border border-ink-600 rounded-lg p-3 text-xs shadow-xl backdrop-blur-sm">
      <div className="font-semibold text-ink-100 mb-2 tracking-tight">AQI scale</div>
      <ul className="space-y-1">
        {categories.map((c) => (
          <li key={c.key} className="flex items-center gap-2 text-ink-200">
            <span
              className="inline-block h-3 w-3 rounded-full border border-white/40"
              style={{ background: c.color }}
            />
            <span className="font-mono tabular-nums w-16">
              {c.min}
              {Number.isFinite(c.max) ? `–${c.max}` : "+"}
            </span>
            <span>{c.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
