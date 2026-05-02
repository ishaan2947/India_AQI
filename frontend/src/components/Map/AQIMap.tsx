/**
 * Full-width interactive Leaflet map centred on India, with one circular,
 * AQI-coloured marker per monitored city. Auto-refreshes every 5 minutes.
 */

import { MapContainer, TileLayer } from "react-leaflet";

import { useCurrentAQI } from "../../hooks/useAQIData";
import { getAllCategories } from "../../utils/aqiHelpers";
import AQIMarker from "./AQIMarker";

const INDIA_CENTER: [number, number] = [22.5, 80.0];
const INITIAL_ZOOM = 5;

interface AQIMapProps {
  onCitySelect?: (cityId: number) => void;
}

export default function AQIMap({ onCitySelect }: AQIMapProps) {
  const { data, loading, error } = useCurrentAQI();

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
          <AQIMarker key={city.id} city={city} onSelect={onCitySelect} />
        ))}
      </MapContainer>

      {loading && !data ? (
        <div className="absolute inset-0 flex items-center justify-center bg-ink-900/60 pointer-events-none">
          <div className="skeleton h-10 w-48" />
        </div>
      ) : null}

      {error ? (
        <div className="absolute top-4 left-4 bg-aqi-unhealthy/90 text-white text-sm px-3 py-2 rounded shadow">
          {error}
        </div>
      ) : null}

      <Legend />
    </div>
  );
}

function Legend() {
  const categories = getAllCategories();
  return (
    <div className="absolute bottom-4 right-4 z-[1000] bg-ink-800/95 border border-ink-600 rounded-lg p-3 text-xs shadow-xl">
      <div className="font-semibold text-ink-100 mb-2">AQI scale</div>
      <ul className="space-y-1">
        {categories.map((c) => (
          <li key={c.key} className="flex items-center gap-2 text-ink-200">
            <span
              className="inline-block h-3 w-3 rounded-full border border-white/40"
              style={{ background: c.color }}
            />
            <span className="font-mono w-16">
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
