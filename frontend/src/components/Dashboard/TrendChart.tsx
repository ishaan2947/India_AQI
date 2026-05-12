/**
 * Historical AQI line chart for a selected city.
 *
 * Toggleable between the last 24 hours and the last 7 days. Highlights a
 * reference line at AQI = 100 (the "unhealthy for sensitive groups"
 * threshold) and colours the trend by the city's mean AQI.
 */

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useCityHistory } from "../../hooks/useAQIData";
import { getAQIColor } from "../../utils/aqiHelpers";

type RangeKey = "24h" | "7d";

const RANGES: Record<RangeKey, { hours: number; label: string }> = {
  "24h": { hours: 24, label: "24h" },
  "7d": { hours: 168, label: "7d" },
};

interface TrendChartProps {
  cityId: number | null;
  cityName?: string;
}

export default function TrendChart({ cityId, cityName }: TrendChartProps) {
  const [range, setRange] = useState<RangeKey>("24h");
  const { hours } = RANGES[range];
  const { data, loading, error } = useCityHistory(cityId, hours);

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.map((r) => ({
      // For 24h view show hour-of-day; for 7d, show "Mon 14:00"
      time: formatTick(r.timestamp, range),
      aqi: Math.round(r.aqi_value),
    }));
  }, [data, range]);

  const meanAQI =
    chartData.length > 0
      ? chartData.reduce((acc, p) => acc + p.aqi, 0) / chartData.length
      : 0;
  const strokeColor = chartData.length > 0 ? getAQIColor(meanAQI) : "#94a3b8";

  return (
    <div className="bg-ink-800 border border-ink-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3 gap-3">
        <h3 className="text-ink-100 font-semibold tracking-tight">
          {RANGES[range].label} trend{cityName ? ` · ${cityName}` : ""}
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-ink-200/70 hidden md:inline">
            Reference: AQI 100
          </span>
          <RangeToggle value={range} onChange={setRange} />
        </div>
      </div>

      {loading && chartData.length === 0 ? (
        <div className="skeleton h-64 w-full" />
      ) : error ? (
        <div className="h-64 flex items-center justify-center text-aqi-unhealthy text-sm">{error}</div>
      ) : chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-ink-200">
          No data for this city yet.
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
              <CartesianGrid stroke="#243150" strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                tick={{ fill: "#cdd5e0", fontSize: 11 }}
                minTickGap={28}
              />
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
                formatter={(value: number) => [
                  <span style={{ color: "#e6ebf2", fontVariantNumeric: "tabular-nums" }}>
                    {value}
                  </span>,
                  "AQI",
                ]}
                cursor={{ stroke: "rgba(255,255,255,0.18)", strokeDasharray: "3 3" }}
              />
              <ReferenceLine
                y={100}
                stroke="#FF7E00"
                strokeDasharray="4 4"
                label={{ value: "100", position: "right", fill: "#FF7E00", fontSize: 10 }}
              />
              <Line
                type="monotone"
                dataKey="aqi"
                stroke={strokeColor}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function formatTick(ts: string, range: RangeKey): string {
  const d = new Date(ts);
  const hh = d.getHours().toString().padStart(2, "0");
  if (range === "24h") return `${hh}:00`;
  // 7d view: "Mon 14:00" — short weekday + hour
  const wday = d.toLocaleDateString(undefined, { weekday: "short" });
  return `${wday} ${hh}:00`;
}

function RangeToggle({
  value,
  onChange,
}: {
  value: RangeKey;
  onChange: (next: RangeKey) => void;
}) {
  return (
    <div className="inline-flex rounded-md bg-ink-700/60 p-0.5 text-[11px] font-medium">
      {(Object.keys(RANGES) as RangeKey[]).map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={
            "px-2.5 py-1 rounded transition " +
            (value === key
              ? "bg-ink-600 text-ink-100 shadow-sm"
              : "text-ink-200 hover:text-ink-100")
          }
        >
          {RANGES[key].label}
        </button>
      ))}
    </div>
  );
}
