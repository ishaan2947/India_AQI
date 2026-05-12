/**
 * ML-prediction panel.
 *
 * Renders a 24-hour AQI forecast as a line chart with a shaded confidence-
 * interval band (derived from per-tree variance of the Random Forest) and
 * a delta vs. the current observation.
 */

import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useCityPrediction } from "../../hooks/usePredictions";
import type { CityWithLatest } from "../../types";
import { formatHour, getAQIColor } from "../../utils/aqiHelpers";

interface PredictionPanelProps {
  city: CityWithLatest | null;
}

export default function PredictionPanel({ city }: PredictionPanelProps) {
  const { data, loading, error } = useCityPrediction(city?.id ?? null);

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.points.map((p) => {
      // Convert confidence to half-width of an interval band. High confidence
      // (≈1) ⇒ narrow band; low confidence ⇒ wider band.
      const halfWidth = Math.max(2, (1 - p.confidence_score) * 60);
      return {
        time: formatHour(p.prediction_for),
        aqi: Math.round(p.predicted_aqi),
        band: [
          Math.max(0, Math.round(p.predicted_aqi - halfWidth)),
          Math.round(p.predicted_aqi + halfWidth),
        ],
      };
    });
  }, [data]);

  const meanPredicted =
    chartData.length > 0
      ? chartData.reduce((acc, p) => acc + p.aqi, 0) / chartData.length
      : 0;
  const strokeColor = chartData.length > 0 ? getAQIColor(meanPredicted) : "#94a3b8";

  const delta =
    city?.latest_aqi != null && chartData.length > 0
      ? chartData[chartData.length - 1].aqi - city.latest_aqi
      : null;

  return (
    <div className="bg-ink-800 border border-ink-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-ink-100 font-semibold">
          ML forecast{city ? ` · ${city.name}` : ""}
        </h3>
        <div className="text-xs text-ink-200">Next 24 hours</div>
      </div>

      {city == null ? (
        <div className="h-64 flex items-center justify-center text-ink-200">
          Pick a city to see the forecast.
        </div>
      ) : loading && chartData.length === 0 ? (
        <div className="skeleton h-64 w-full" />
      ) : error ? (
        <div className="h-64 flex items-center justify-center text-aqi-unhealthy">{error}</div>
      ) : (
        <>
          {delta != null ? (
            <div className="mb-3 flex items-baseline gap-3">
              <div className="text-sm text-ink-200">vs current ({Math.round(city!.latest_aqi!)}):</div>
              <div
                className="text-lg font-bold"
                style={{ color: delta > 0 ? "#FF0000" : "#00E400" }}
              >
                {delta > 0 ? "↑" : "↓"} {Math.abs(Math.round(delta))}
              </div>
            </div>
          ) : null}

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
                <CartesianGrid stroke="#243150" strokeDasharray="3 3" />
                <XAxis dataKey="time" tick={{ fill: "#cdd5e0", fontSize: 11 }} />
                <YAxis tick={{ fill: "#cdd5e0", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "#0f172a",
                    border: "1px solid #334155",
                    color: "#e6ebf2",
                    fontSize: 12,
                    borderRadius: 8,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.55)",
                  }}
                  labelStyle={{ color: "#f8fafc", fontWeight: 600, marginBottom: 4 }}
                  itemStyle={{ color: "#e6ebf2" }}
                  formatter={(value: number, name: string) => {
                    if (name === "band") return [null, null];
                    return [
                      <span style={{ color: "#e6ebf2", fontVariantNumeric: "tabular-nums" }}>
                        {value}
                      </span>,
                      "Predicted AQI",
                    ];
                  }}
                  cursor={{ stroke: "rgba(255,255,255,0.18)", strokeDasharray: "3 3" }}
                />
                <Area
                  type="monotone"
                  dataKey="band"
                  stroke="none"
                  fill={strokeColor}
                  fillOpacity={0.15}
                />
                <Line
                  type="monotone"
                  dataKey="aqi"
                  stroke={strokeColor}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
