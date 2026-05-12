/**
 * Custom Leaflet marker for an AQI reading.
 *
 * Why a `CircleMarker` and not the default Leaflet pin? Two reasons:
 *   1. We want the colour to encode the AQI category — much easier with a
 *      styled circle than with a custom PNG per category.
 *   2. Size scales with severity; sprites can't do that cleanly.
 *
 * Click flow:
 *   - Click the marker → map gently flies to centre on it AND its popup opens.
 *   - Inside the popup is a "View 24h trend & forecast →" link that
 *     navigates to the detail page. We deliberately don't auto-navigate so
 *     the user can keep exploring the map without losing context.
 */

import { useMemo } from "react";
import { CircleMarker, Popup, useMap } from "react-leaflet";
import { Link } from "react-router-dom";

import type { CityWithLatest } from "../../types";
import {
  formatTimestamp,
  getAQICategory,
  getAQIColor,
  getAQIDescription,
  getMarkerSize,
} from "../../utils/aqiHelpers";

interface AQIMarkerProps {
  city: CityWithLatest;
  /** When true the marker pulses subtly — used for the top-1 worst city. */
  isWorst?: boolean;
}

export default function AQIMarker({ city, isWorst = false }: AQIMarkerProps) {
  const aqi = city.latest_aqi;
  const map = useMap();

  const { color, radius, category, description } = useMemo(() => {
    if (aqi == null) {
      return {
        color: "#475569",
        radius: 10,
        category: "No data",
        description: "Awaiting first reading.",
      };
    }
    return {
      color: getAQIColor(aqi),
      radius: getMarkerSize(aqi) / 2,
      category: getAQICategory(aqi),
      description: getAQIDescription(aqi),
    };
  }, [aqi]);

  const hasReading = aqi != null;

  return (
    <CircleMarker
      center={[city.lat, city.lng]}
      radius={radius}
      pathOptions={{
        color: "rgba(255, 255, 255, 0.85)",
        weight: 2,
        fillColor: color,
        fillOpacity: 0.85,
        className: isWorst ? "aqi-marker-pulse" : undefined,
      }}
      eventHandlers={{
        click: () => {
          map.flyTo([city.lat, city.lng], Math.max(map.getZoom(), 6), {
            duration: 0.8,
          });
        },
      }}
    >
      <Popup>
        <div className="text-slate-900 min-w-[180px]">
          <div className="font-semibold text-base">{city.name}</div>
          <div className="text-xs text-slate-600 mb-2">{city.state}</div>
          {hasReading ? (
            <>
              <div className="text-3xl font-bold font-mono tabular-nums leading-none" style={{ color }}>
                {aqi?.toFixed(0)}
              </div>
              <div className="text-xs font-medium mt-1">{category}</div>
              <div className="text-[11px] text-slate-600 mt-1">{description}</div>
              <div className="text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-200">
                PM2.5: <span className="font-mono tabular-nums">{city.latest_pm25?.toFixed(1) ?? "—"}</span> µg/m³
                <br />
                Updated {formatTimestamp(city.latest_timestamp)}
                {city.latest_source ? ` · ${city.latest_source}` : ""}
              </div>
              <Link
                to={`/cities/${city.id}`}
                className="mt-3 inline-flex items-center text-xs font-semibold text-slate-900 hover:underline"
                style={{ color }}
              >
                View 24h trend & forecast →
              </Link>
            </>
          ) : (
            <div className="text-xs text-slate-500">No reading yet.</div>
          )}
        </div>
      </Popup>
    </CircleMarker>
  );
}
