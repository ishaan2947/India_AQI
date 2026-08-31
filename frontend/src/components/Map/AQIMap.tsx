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
import { MapContainer, TileLayer, useMap } from "react-leaflet";

import type { LatLngBoundsLiteral } from "leaflet";

import { useCurrentAQI } from "../../hooks/useAQIData";
import { getAllCategories } from "../../utils/aqiHelpers";
import AQIMarker from "./AQIMarker";

// The subject is India, so the map is India. INDIA_BOUNDS is what we frame on
// load; PAN_BOUNDS is the hard wall for dragging — a little slack around the
// country so edge cities aren't pinned against the frame, but nowhere near far
// enough to sail off into the Atlantic.
const INDIA_BOUNDS: LatLngBoundsLiteral = [
  [6.0, 67.0], // SW — below Kanyakumari, west of Kutch
  [36.5, 98.0], // NE — above Kashmir, east of Arunachal
];
const PAN_BOUNDS: LatLngBoundsLiteral = [
  [3.5, 63.5],
  [38.5, 101.5],
];

// Basemap: Esri's dark canvas, one of the few genuinely key-free dark tile
// sets left. (CARTO, the previous provider, now stamps "API KEY REQUIRED"
// diagonally across every tile served without a key.) Esri's coverage stops
// at z16 — past that it returns a "map data not yet available" placeholder,
// so we cap zoom there instead of letting the user find it. Labels ship as a
// separate transparent overlay: light text with dark halos, built for exactly
// this base.
const MIN_ZOOM = 4;
const MAX_ZOOM = 16;
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas";
const BASE_TILES = `${ESRI}/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`;
const LABEL_TILES = `${ESRI}/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`;
const ATTRIBUTION =
  'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &middot; Esri, HERE, ' +
  'Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

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
        bounds={INDIA_BOUNDS}
        maxBounds={PAN_BOUNDS}
        maxBoundsViscosity={1}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        scrollWheelZoom
        className="h-full w-full"
      >
        <ClampToIndia />
        <TileLayer
          attribution={ATTRIBUTION}
          url={BASE_TILES}
          maxZoom={MAX_ZOOM}
          maxNativeZoom={MAX_ZOOM}
          noWrap
        />
        <TileLayer
          url={LABEL_TILES}
          maxZoom={MAX_ZOOM}
          maxNativeZoom={MAX_ZOOM}
          noWrap
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
 * Pins the zoom floor to "the whole country just fits". Leaflet's default
 * floor is zoom 0, which lets you pull back far enough to see six copies of
 * the world tiled across the screen — India a speck in the middle of it.
 *
 * The right floor depends on the viewport (a phone in portrait needs to sit
 * further out than a desktop), so we ask Leaflet what zoom fits INDIA_BOUNDS
 * and recompute it whenever the container resizes.
 */
function ClampToIndia() {
  const map = useMap();

  useEffect(() => {
    const clamp = () => {
      const floor = map.getBoundsZoom(INDIA_BOUNDS);
      if (Number.isFinite(floor)) {
        map.setMinZoom(Math.min(floor, MAX_ZOOM));
      }
    };
    clamp();
    map.on("resize", clamp);
    return () => {
      map.off("resize", clamp);
    };
  }, [map]);

  return null;
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
    <div className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 z-[1000] bg-ink-800/95 border border-ink-600 rounded-lg p-2 sm:p-3 text-[10px] sm:text-xs shadow-xl backdrop-blur-sm max-w-[calc(100%-1rem)]">
      <div className="font-semibold text-ink-100 mb-1.5 sm:mb-2 tracking-tight">
        AQI scale
      </div>
      <ul className="space-y-0.5 sm:space-y-1">
        {categories.map((c) => (
          <li key={c.key} className="flex items-center gap-1.5 sm:gap-2 text-ink-200">
            <span
              className="inline-block h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0 rounded-full border border-white/40"
              style={{ background: c.color }}
            />
            <span className="font-mono tabular-nums w-12 sm:w-16">
              {c.min}
              {Number.isFinite(c.max) ? `–${c.max}` : "+"}
            </span>
            <span className="hidden sm:inline">{c.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
