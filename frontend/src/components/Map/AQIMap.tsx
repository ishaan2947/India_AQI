/**
 * The map: thirty readings in their real spatial relationship.
 *
 * Art direction is borrowed from Windy and Apple's air-quality layer — the
 * basemap is graded down to a near-monochrome ground (see `.leaflet-tile-pane`
 * in index.css), every panel is a flat card with a hairline instead of a
 * glossy rounded bubble, and the only saturated colour on screen is the data.
 * The markers carry their own values, so the map answers "how bad is it
 * there?" without a click.
 *
 * The page accent follows the worst reading on screen, which is why the
 * legend's needle and the sidebar's rules change colour from one hour to the
 * next.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";

import type { LatLngBoundsLiteral } from "leaflet";

import { useAccent } from "../../hooks/useAccent";
import { useCurrentAQI } from "../../hooks/useAQIData";
import type { CityWithLatest } from "../../types";
import { getAQIBand, getAllCategories } from "../../utils/aqiHelpers";
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
  const [zoom, setZoom] = useState(MIN_ZOOM);

  // Place names fade up with zoom: at country scale they are clutter
  // competing with the data; by city scale they are the context that makes a
  // reading mean something.
  const labelOpacity = Math.min(0.8, Math.max(0.3, (zoom - 4) * 0.14 + 0.3));

  const worst = useMemo(() => {
    if (!data) return null;
    let found: { id: number; aqi: number } | null = null;
    for (const city of data) {
      if (city.latest_aqi == null) continue;
      if (!found || city.latest_aqi > found.aqi) {
        found = { id: city.id, aqi: city.latest_aqi };
      }
    }
    return found;
  }, [data]);

  const worstBand = worst ? getAQIBand(worst.aqi) : null;
  useAccent(worstBand?.textColor ?? null, worstBand?.color ?? null);

  return (
    <div className="relative h-full w-full">
      <MapContainer
        bounds={INDIA_BOUNDS}
        maxBounds={PAN_BOUNDS}
        maxBoundsViscosity={1}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        scrollWheelZoom
        zoomControl={false}
        // Leaflet snaps to whole zoom levels, which is why its maps feel
        // stepped next to Windy's. Quarter-level snapping with a half-level
        // wheel delta is the difference between jumping between scales and
        // zooming.
        zoomSnap={0.25}
        zoomDelta={0.5}
        wheelPxPerZoomLevel={140}
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
          className="map-labels"
          opacity={labelOpacity}
          maxZoom={MAX_ZOOM}
          maxNativeZoom={MAX_ZOOM}
          noWrap
        />
        <ZoomControl />
        <ZoomWatcher onZoom={setZoom} />
        <Readings cities={data ?? []} worstId={worst?.id ?? null} zoom={zoom} />
      </MapContainer>

      {loading && !data ? <ColdStartOverlay /> : null}
      {error ? <ErrorNotice message={error} /> : null}

      <Legend />
    </div>
  );
}

/**
 * Which readings can actually be drawn at this zoom without colliding.
 *
 * Thirty chips at country scale overlap badly across the Indo-Gangetic plain
 * — Delhi sits on Meerut, Ludhiana on Chandigarh — and a pile of half-hidden
 * numbers is the single thing that most makes a data map look unfinished.
 * Windy solves it by decluttering, and so does this: project every city to
 * screen pixels, walk them worst-first, and keep a chip only if it clears the
 * ones already kept. The rest stay on the map as dots, so nothing is hidden
 * and the pattern is intact; zoom in and they become chips as space appears.
 */
function Readings({
  cities,
  worstId,
  zoom,
}: {
  cities: CityWithLatest[];
  worstId: number | null;
  zoom: number;
}) {
  const map = useMap();
  const [visible, setVisible] = useState<Set<number>>(new Set());

  const declutter = useCallback(() => {
    const ranked = cities
      .filter((c) => c.latest_aqi != null)
      .slice()
      .sort((a, b) => (b.latest_aqi ?? 0) - (a.latest_aqi ?? 0));

    const kept: Array<{ x: number; y: number; r: number }> = [];
    const keptIds = new Set<number>();

    for (const city of ranked) {
      const point = map.latLngToContainerPoint([city.lat, city.lng]);
      const radius = chipRadius(city.latest_aqi ?? 0, zoom);
      const clears = kept.every((k) => {
        const dx = k.x - point.x;
        const dy = k.y - point.y;
        // A few pixels of air between chips, so "not overlapping" also looks
        // like not overlapping.
        return Math.hypot(dx, dy) > k.r + radius + 6;
      });
      if (clears) {
        kept.push({ x: point.x, y: point.y, r: radius });
        keptIds.add(city.id);
      }
    }
    setVisible(keptIds);
  }, [cities, map, zoom]);

  useEffect(declutter, [declutter]);
  useMapEvents({ zoomend: declutter, moveend: declutter, resize: declutter });

  return (
    <>
      {cities.map((city) => (
        <AQIMarker
          key={city.id}
          city={city}
          isWorst={city.id === worstId}
          collapsed={!visible.has(city.id)}
          labelled={zoom >= 6.5}
        />
      ))}
    </>
  );
}

/** Keep in step with chipSize() in AQIMarker. */
function chipRadius(aqi: number, zoom: number): number {
  const base = 28 + (Math.max(0, Math.min(400, aqi)) / 400) * 16;
  return (base * (zoom >= 6.5 ? 1.9 : 1)) / 2;
}

/** Reports live zoom so markers and labels can respond to scale. */
function ZoomWatcher({ onZoom }: { onZoom: (zoom: number) => void }) {
  const map = useMap();
  useEffect(() => {
    onZoom(map.getZoom());
  }, [map, onZoom]);
  useMapEvents({ zoomend: (e) => onZoom(e.target.getZoom()) });
  return null;
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
 * Our own zoom control rather than Leaflet's.
 *
 * Leaflet's is a pair of anchor tags carrying "+" and "−" as text content,
 * which means fighting its stylesheet with `!important` for every state and
 * still ending up with a browser-chrome-looking widget. Two buttons cost
 * nothing and take the design system directly.
 */
function ZoomControl() {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  useEffect(() => {
    const sync = () => setZoom(map.getZoom());
    map.on("zoomend", sync);
    return () => {
      map.off("zoomend", sync);
    };
  }, [map]);

  const atMin = zoom <= map.getMinZoom();
  const atMax = zoom >= map.getMaxZoom();

  const base =
    "flex h-9 w-9 items-center justify-center text-smoke-200 transition-colors duration-tap ease-air hover:bg-smoke-800 hover:text-smoke-100 disabled:cursor-not-allowed disabled:text-smoke-600 disabled:hover:bg-transparent";

  return (
    <div className="absolute left-3 top-3 z-[1000] flex flex-col border border-smoke-700 bg-smoke-900 shadow-[0_8px_24px_rgba(0,0,0,0.5)] sm:left-4 sm:top-4">
      <button
        type="button"
        onClick={() => map.zoomIn()}
        disabled={atMax}
        aria-label="Zoom in"
        className={`${base} border-b border-smoke-700`}
      >
        <svg viewBox="0 0 14 14" aria-hidden className="h-3.5 w-3.5 stroke-current stroke-[1.5]">
          <path d="M7 1v12M1 7h12" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => map.zoomOut()}
        disabled={atMin}
        aria-label="Zoom out"
        className={base}
      >
        <svg viewBox="0 0 14 14" aria-hidden className="h-3.5 w-3.5 stroke-current stroke-[1.5]">
          <path d="M1 7h12" />
        </svg>
      </button>
    </div>
  );
}

/**
 * Shown only when there is nothing to draw yet. Free-tier Render takes
 * ~30–60s to wake from sleep, so the overlay says that in words rather than
 * spinning at the reader.
 */
function ColdStartOverlay() {
  const [showHint, setShowHint] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setShowHint(true), 4000);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-[900] flex items-center justify-center bg-smoke-950/70">
      <div className="max-w-xs px-6 text-center">
        <div className="skeleton mx-auto h-10 w-10 rounded-full" />
        <p className="mt-4 font-serif text-body text-smoke-200">
          {showHint
            ? "Waking the backend. The free tier sleeps when nobody's looking; the first request takes about thirty seconds."
            : "Loading readings…"}
        </p>
      </div>
    </div>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="absolute left-3 top-16 z-[1000] max-w-sm border border-smoke-700 border-l-2 border-l-aqi-veryPoor bg-smoke-900 px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.5)] sm:left-4 sm:top-[4.5rem]"
    >
      <p className="u-label text-aqi-veryPoor-text">Readings unavailable</p>
      <p className="mt-1.5 text-micro leading-relaxed text-smoke-200">{message}</p>
    </div>
  );
}

/**
 * The scale as one continuous strip, matching the landing page's legend —
 * it is a single dimension, so it should look like one object rather than six
 * chips in a list.
 */
function Legend() {
  const bands = getAllCategories();
  return (
    <div className="absolute bottom-6 right-3 z-[1000] w-[11.5rem] border border-smoke-700 bg-smoke-900/95 px-3 py-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.5)] sm:bottom-8 sm:right-4 sm:w-[13rem]">
      <p className="u-label">AQI · CPCB</p>
      <div className="mt-2 flex h-2 w-full overflow-hidden">
        {bands.map((b) => (
          <span
            key={b.key}
            className="h-full"
            style={{
              background: b.color,
              flexGrow: Math.min(b.max, 500) - b.min + 1,
            }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-smoke-500 tnum">
        <span>0</span>
        <span>200</span>
        <span>400</span>
        <span>500</span>
      </div>
      <p className="mt-1.5 text-[10px] leading-tight text-smoke-500">
        Good to severe. Marker size follows the reading.
      </p>
    </div>
  );
}
