/**
 * 24-hour AQI trend line chart for a selected city.
 *
 * Highlights a reference line at AQI = 100 (the "unhealthy for sensitive
 * groups" threshold) and colours the trend by the city's mean AQI.
 */

import { useMemo } from "react";
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
import { formatHour, getAQIColor } from "../../utils/aqiHelpers";

interface TrendChartProps {
  cityId: number | null;
  cityName?: string;
}

export default function TrendChart({ cityId, cityName }: TrendChartProps) {
  const { data, loading, error } = useCityHistory(cityId, 24);

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.map((r) => ({
      time: formatHour(r.timestamp),
      aqi: Math.round(r.aqi_value),
      pm25: r.pm25 ?? null,
    }));
  }, [data]);

  const meanAQI =
    chartData.length > 0
      ? chartData.reduce((acc, p) => acc + p.aqi, 0) / chartData.length
      : 0;
  const strokeColor = chartData.length > 0 ? getAQIColor(meanAQI) : "#94a3b8";

  return (
    <div className="bg-ink-800 border border-ink-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-ink-100 font-semibold">
          24-hour trend{cityName ? ` · ${cityName}` : ""}
        </h3>
        <div className="text-xs text-ink-200">Reference line: AQI 100</div>
      </div>

      {loading && chartData.length === 0 ? (
        <div className="skeleton h-64 w-full" />
      ) : error ? (
        <div className="h-64 flex items-center justify-center text-aqi-unhealthy">{error}</div>
      ) : chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-ink-200">
          No data for this city yet.
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
              <CartesianGrid stroke="#243150" strokeDasharray="3 3" />
              <XAxis dataKey="time" tick={{ fill: "#cdd5e0", fontSize: 11 }} />
              <YAxis tick={{ fill: "#cdd5e0", fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: "#111a2e",
                  border: "1px solid #243150",
                  color: "#e6ebf2",
                  fontSize: 12,
                }}
                labelStyle={{ color: "#cdd5e0" }}
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
