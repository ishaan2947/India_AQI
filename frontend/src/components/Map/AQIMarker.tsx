/**
 * Custom Leaflet marker for an AQI reading.
 *
 * Why a `divIcon` and not the default Leaflet pin? Two reasons:
 *   1. We want the colour to encode the AQI category — much easier with a
 *      styled div than with a custom PNG per category.
 *   2. Size scales with severity; sprites can't do that cleanly.
 */

import { useMemo } from "react";
import { CircleMarker, Popup } from "react-leaflet";

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
  onSelect?: (cityId: number) => void;
}

export default function AQIMarker({ city, onSelect }: AQIMarkerProps) {
  const aqi = city.latest_aqi;

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
      }}
      eventHandlers={{
        click: () => onSelect?.(city.id),
      }}
    >
      <Popup>
        <div className="text-slate-900">
          <div className="font-semibold text-base">{city.name}</div>
          <div className="text-xs text-slate-600 mb-2">{city.state}</div>
          {hasReading ? (
            <>
              <div className="text-2xl font-bold leading-none" style={{ color }}>
                {aqi?.toFixed(0)}
              </div>
              <div className="text-xs font-medium mt-1">{category}</div>
              <div className="text-[11px] text-slate-600 mt-1">{description}</div>
              <div className="text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-200">
                PM2.5: {city.latest_pm25?.toFixed(1) ?? "—"} µg/m³
                <br />
                Updated {formatTimestamp(city.latest_timestamp)}
                {city.latest_source ? ` · ${city.latest_source}` : ""}
              </div>
            </>
          ) : (
            <div className="text-xs text-slate-500">No reading yet.</div>
          )}
        </div>
      </Popup>
    </CircleMarker>
  );
}
