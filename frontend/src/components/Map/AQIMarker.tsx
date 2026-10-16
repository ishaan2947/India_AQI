/**
 * A reading on the map, drawn the way Windy and Apple's air-quality layer
 * draw one: not a pin pointing at a city, but the *number itself* sitting
 * where the city is.
 *
 * The old marker was a Leaflet `CircleMarker` — a coloured disc with a white
 * stroke. It told you a city was there and roughly how bad it was, and to
 * learn anything more you had to click it. A value chip tells you the same
 * thing and the actual figure at a glance, which is the whole argument for
 * a map over a table: thirty numbers in their real spatial relationship.
 *
 * Implementation notes:
 *   - `divIcon` rather than `CircleMarker`, because a disc can't hold type.
 *     The chip is styled in index.css (`.aqi-pin`) so hover, focus and the
 *     worst-city ring are CSS, not re-renders.
 *   - Diameter scales with the value, and the figure inside scales with the
 *     diameter, so a 450 reads as physically bigger than a 60 before you
 *     have read either number.
 *   - Ink on the chip flips with the band: the three light bands take near
 *     black, the two dark ones take near white. Nothing in the scale is ever
 *     white-on-yellow.
 */

import { useMemo } from "react";
import { divIcon } from "leaflet";
import { Marker, Popup, useMap } from "react-leaflet";
import { Link } from "react-router-dom";

import type { CityWithLatest } from "../../types";
import {
  formatISTClock,
  formatTimestamp,
  getAQIBand,
} from "../../utils/aqiHelpers";

interface AQIMarkerProps {
  city: CityWithLatest;
  /** The single worst reading on the map gets a standing ring. */
  isWorst?: boolean;
}

/** 28px at the bottom of the scale, 44px at the top. */
function chipSize(aqi: number): number {
  const clamped = Math.max(0, Math.min(400, aqi));
  return Math.round(28 + (clamped / 400) * 16);
}

/** Bands light enough to need dark type on them. */
const DARK_INK = new Set(["good", "satisfactory", "moderate", "poor"]);

export default function AQIMarker({ city, isWorst = false }: AQIMarkerProps) {
  const aqi = city.latest_aqi;
  const map = useMap();
  const band = aqi != null ? getAQIBand(aqi) : null;

  const icon = useMemo(() => {
    const size = aqi != null ? chipSize(aqi) : 24;
    const fill = band?.color ?? "#302B28";
    const ink = band && DARK_INK.has(band.key) ? "#140F0C" : "#FBF7F2";
    const value = aqi != null ? String(Math.round(aqi)) : "·";

    return divIcon({
      // Leaflet's default icon class paints a white box behind everything.
      className: `aqi-pin${isWorst ? " aqi-pin--worst" : ""}`,
      html: `<span class="aqi-pin__chip" style="--pin:${fill};--pin-ink:${ink};--pin-d:${size}px">${value}</span>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2 - 2],
    });
  }, [aqi, band, isWorst]);

  return (
    <Marker
      position={[city.lat, city.lng]}
      icon={icon}
      // Keyboard users tab through the markers; without a title the
      // accessible name would be the empty chip.
      title={
        aqi != null
          ? `${city.name}: AQI ${Math.round(aqi)}, ${band?.label}`
          : `${city.name}: no reading`
      }
      alt={city.name}
      // In the Indo-Gangetic cluster chips overlap; the worse reading is the
      // one you want on top.
      zIndexOffset={aqi != null ? Math.round(aqi) : 0}
      eventHandlers={{
        click: () => {
          map.flyTo([city.lat, city.lng], Math.max(map.getZoom(), 6), {
            duration: 0.8,
          });
        },
      }}
    >
      <Popup>
        <div className="w-[15rem]">
          <p className="u-label text-smoke-500">{city.state}</p>
          <p className="mt-0.5 text-[1.5rem] font-semibold leading-tight text-smoke-100">
            {city.name}
          </p>

          {aqi != null && band ? (
            <>
              <div className="mt-3 flex items-end gap-3 border-t border-smoke-700 pt-3">
                <span
                  className="u-figure text-[2.75rem] leading-[0.85]"
                  style={{ color: band.textColor }}
                >
                  {Math.round(aqi)}
                </span>
                <span className="pb-0.5">
                  <span className="block font-serif text-body text-smoke-100">
                    {band.verdict}
                  </span>
                  <span
                    className="u-label"
                    style={{ color: band.textColor }}
                  >
                    {band.label}
                  </span>
                </span>
              </div>

              <dl className="mt-3 space-y-1 text-micro text-smoke-300 tnum">
                <div className="flex justify-between gap-3">
                  <dt className="text-smoke-500">PM2.5</dt>
                  <dd>
                    {city.latest_pm25 != null
                      ? `${city.latest_pm25.toFixed(0)} µg/m³`
                      : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-smoke-500">Reading for</dt>
                  <dd>{formatISTClock(city.latest_timestamp) ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-smoke-500">Updated</dt>
                  <dd>{formatTimestamp(city.latest_timestamp)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-smoke-500">Source</dt>
                  <dd>
                    {city.latest_source?.toLowerCase() === "synthetic"
                      ? "Synthetic fallback"
                      : "WAQI"}
                  </dd>
                </div>
              </dl>

              <Link
                to={`/cities/${city.id}`}
                className="group mt-4 inline-flex items-baseline gap-2 border-t border-smoke-700 pt-3 text-micro font-semibold text-smoke-100"
              >
                24-hour trend &amp; forecast
                <span
                  aria-hidden
                  className="transition-transform duration-move ease-air group-hover:translate-x-1"
                  style={{ color: band.textColor }}
                >
                  →
                </span>
              </Link>
            </>
          ) : (
            <p className="mt-3 border-t border-smoke-700 pt-3 font-serif text-body text-smoke-300">
              No reading yet for this station.
            </p>
          )}
        </div>
      </Popup>
    </Marker>
  );
}
