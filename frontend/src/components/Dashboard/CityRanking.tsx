/**
 * Horizontal bar chart of the top-15 most polluted cities, bars coloured by
 * AQI category.
 */

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useWorstCities } from "../../hooks/useAQIData";
import { getAQIColor } from "../../utils/aqiHelpers";

export default function CityRanking() {
  const { data, loading, error } = useWorstCities();

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.entries.slice(0, 15).map((entry) => ({
      name: entry.city_name,
      aqi: Math.round(entry.aqi_value),
      fill: getAQIColor(entry.aqi_value),
    }));
  }, [data]);

  return (
    <div className="bg-ink-800 border border-ink-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-ink-100 font-semibold">Most polluted cities</h3>
        <div className="text-xs text-ink-200">Top 15 by current AQI</div>
      </div>

      {loading && chartData.length === 0 ? (
        <div className="skeleton h-[420px] w-full" />
      ) : error ? (
        <div className="h-[420px] flex items-center justify-center text-aqi-unhealthy">{error}</div>
      ) : chartData.length === 0 ? (
        <div className="h-[420px] flex items-center justify-center text-ink-200">
          No data available.
        </div>
      ) : (
        <div style={{ height: 420 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 32, left: 16, bottom: 4 }}>
              <XAxis type="number" tick={{ fill: "#cdd5e0", fontSize: 11 }} />
              <YAxis
                dataKey="name"
                type="category"
                width={100}
                tick={{ fill: "#cdd5e0", fontSize: 11 }}
              />
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
                cursor={{ fill: "rgba(255,255,255,0.06)" }}
              />
              <Bar dataKey="aqi" radius={[0, 6, 6, 0]}>
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
                <LabelList dataKey="aqi" position="right" fill="#cdd5e0" fontSize={11} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
