/**
 * One city, forty-eight hours: what the air did, and what the model thinks it
 * will do, on a single axis.
 *
 * The page used to carry two charts in two cards — a history card and a
 * forecast card, each with its own y-axis, its own colour and its own idea of
 * where "now" was. That is one continuous thing cut in half and framed twice.
 * Read as one series, the handover is the most interesting moment on the
 * page: you can see whether the model has picked up the trend it is being
 * handed, which is the only way a reader can form a view about whether to
 * believe it.
 *
 * Two pieces of furniture do most of the work:
 *
 *   - CPCB bands painted into the plot as horizontal stripes. With them, 180
 *     doesn't need a legend — the line is sitting in the yellow. Without them
 *     every reader has to carry the thresholds in their head.
 *   - The confidence band is a real quantity, not decoration: the API's
 *     `confidence_score` is `1 - σ/mean` across the 120 trees, so
 *     `(1 - confidence) × predicted` reconstructs σ exactly. The shaded area
 *     is ±1σ of the ensemble and is labelled as such.
 */

import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useCityHistory } from "../../hooks/useAQIData";
import { useCityPrediction } from "../../hooks/usePredictions";
import {
  formatISTHourLabel,
  getAQIBand,
  parseApiTimestamp,
} from "../../utils/aqiHelpers";
import { axisLine, axisTick, BAND_STRIPES, CHART } from "../charts/theme";

type RangeKey = "24h" | "7d";
const RANGES: Record<RangeKey, { hours: number; label: string; step: number }> = {
  // `step` is the tick interval in hours — six for a day, twenty-four for a
  // week, so the axis never crowds.
  "24h": { hours: 24, label: "Last 24 hours", step: 6 },
  "7d": { hours: 168, label: "Last 7 days", step: 24 },
};

interface Point {
  t: number;
  actual?: number;
  predicted?: number;
  band?: [number, number];
}

export default function CityTimeline({
  cityId,
  cityName,
}: {
  cityId: number;
  cityName: string;
}) {
  const [range, setRange] = useState<RangeKey>("24h");
  const history = useCityHistory(cityId, RANGES[range].hours);
  const prediction = useCityPrediction(cityId);

  const { data, nowMs, yMax, peak } = useMemo(() => {
    const points: Point[] = [];

    const readings = history.data ?? [];
    for (const r of readings) {
      const d = parseApiTimestamp(r.timestamp);
      if (!d) continue;
      points.push({ t: d.getTime(), actual: r.aqi_value });
    }

    const last = points[points.length - 1];
    // Seed the forecast line from the final observation, so the two series
    // meet instead of leaving a gap at the handover.
    if (last) last.predicted = last.actual;

    for (const p of prediction.data?.points ?? []) {
      const d = parseApiTimestamp(p.prediction_for);
      if (!d) continue;
      // confidence = 1 - σ/mean, so this is σ in AQI units.
      const sigma = Math.max(1, (1 - p.confidence_score) * p.predicted_aqi);
      points.push({
        t: d.getTime(),
        predicted: p.predicted_aqi,
        band: [Math.max(0, p.predicted_aqi - sigma), p.predicted_aqi + sigma],
      });
    }

    points.sort((a, b) => a.t - b.t);

    const values = points.flatMap((p) =>
      [p.actual, p.predicted, p.band?.[1]].filter(
        (v): v is number => typeof v === "number",
      ),
    );
    const max = values.length ? Math.max(...values) : 100;
    const peakPoint = points.reduce<Point | null>((acc, p) => {
      const v = p.actual ?? p.predicted ?? 0;
      const accV = acc ? (acc.actual ?? acc.predicted ?? 0) : -1;
      return v > accV ? p : acc;
    }, null);

    return {
      data: points,
      nowMs: last?.t ?? Date.now(),
      yMax: Math.ceil((max * 1.12) / 50) * 50,
      peak: peakPoint,
    };
  }, [history.data, prediction.data]);

  const band = peak
    ? getAQIBand(peak.actual ?? peak.predicted ?? 0)
    : getAQIBand(0);

  const ticks = useMemo(() => {
    if (data.length === 0) return [];
    const stepMs = RANGES[range].step * 3600_000;
    const first = Math.ceil(data[0].t / stepMs) * stepMs;
    const out: number[] = [];
    for (let t = first; t <= data[data.length - 1].t; t += stepMs) out.push(t);
    return out;
  }, [data, range]);

  const loading =
    (history.loading && !history.data) ||
    (prediction.loading && !prediction.data);

  return (
    <section aria-labelledby="timeline-heading">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-smoke-700 pb-3">
        <div>
          <h2 id="timeline-heading" className="text-head text-smoke-100">
            {cityName}, hour by hour
          </h2>
          <p className="mt-1 text-micro text-smoke-500">
            Observed to now, then the 24-hour forecast with ±1σ across the 120
            trees. AQI on the CPCB scale · hours in IST.
          </p>
        </div>
        <div className="flex items-baseline gap-5">
          {(Object.keys(RANGES) as RangeKey[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={range === key}
              onClick={() => setRange(key)}
              className={`u-label border-b pb-1 transition-colors duration-tap ease-air ${
                range === key
                  ? "border-[color:var(--accent)] text-smoke-100"
                  : "border-transparent text-smoke-500 hover:text-smoke-200"
              }`}
            >
              {RANGES[key].label}
            </button>
          ))}
        </div>
      </div>

      {loading && data.length === 0 ? (
        <div className="skeleton mt-4 h-[320px] w-full" />
      ) : history.error && data.length === 0 ? (
        <p className="mt-6 font-serif text-body text-smoke-300">
          {history.error}
        </p>
      ) : data.length === 0 ? (
        <p className="mt-6 font-serif text-body text-smoke-300">
          No readings for this city yet.
        </p>
      ) : (
        <>
          <div className="mt-4 h-[300px] w-full sm:h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={data}
                margin={{ top: 8, right: 8, bottom: 4, left: 0 }}
              >
                {/* The scale, painted in. */}
                {BAND_STRIPES.map((s) => (
                  <ReferenceArea
                    key={s.from}
                    y1={s.from}
                    y2={Math.min(s.to, yMax)}
                    fill={s.fill}
                    stroke="none"
                    ifOverflow="hidden"
                  />
                ))}

                <CartesianGrid
                  stroke={CHART.grid}
                  vertical={false}
                  strokeDasharray="0"
                />
                <XAxis
                  dataKey="t"
                  type="number"
                  scale="time"
                  domain={["dataMin", "dataMax"]}
                  ticks={ticks}
                  tickFormatter={(t: number) =>
                    formatISTHourLabel(new Date(t).toISOString())
                  }
                  tick={axisTick}
                  axisLine={axisLine}
                  tickLine={false}
                  minTickGap={16}
                />
                <YAxis
                  domain={[0, yMax]}
                  width={38}
                  tick={axisTick}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<TimelineTooltip nowMs={nowMs} />}
                  cursor={{ stroke: CHART.axis, strokeWidth: 1 }}
                />

                <Area
                  type="monotone"
                  dataKey="band"
                  stroke="none"
                  fill={band.color}
                  fillOpacity={0.18}
                  isAnimationActive={false}
                  activeDot={false}
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="#EFEAE4"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3, fill: "#EFEAE4", stroke: "none" }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="predicted"
                  stroke={band.textColor}
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                  activeDot={{ r: 3, fill: band.textColor, stroke: "none" }}
                  connectNulls={false}
                  isAnimationActive={false}
                />

                <ReferenceLine
                  x={nowMs}
                  stroke={CHART.now}
                  strokeWidth={1}
                  label={{
                    value: "NOW",
                    position: "insideTopRight",
                    fill: CHART.label,
                    fontSize: 10,
                    letterSpacing: "0.09em",
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Direct labels instead of a legend box. */}
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-micro text-smoke-500">
            <span className="flex items-center gap-2">
              <span className="h-px w-6 bg-smoke-100" /> observed
            </span>
            <span className="flex items-center gap-2">
              <span
                className="h-px w-6"
                style={{
                  backgroundImage: `repeating-linear-gradient(to right, ${band.textColor} 0 5px, transparent 5px 9px)`,
                }}
              />
              forecast
            </span>
            <span className="flex items-center gap-2">
              <span
                className="h-2.5 w-6"
                style={{ background: band.color, opacity: 0.18 }}
              />
              ±1σ across the 120 trees
            </span>
            {prediction.error ? (
              <span className="text-aqi-veryPoor-text">
                Forecast unavailable — {prediction.error}
              </span>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}

/**
 * The tooltip is a flat card in the page's own palette, and it says which
 * side of "now" the reader is on — a predicted 240 and an observed 240 are
 * not the same claim.
 */
function TimelineTooltip({
  active,
  payload,
  label,
  nowMs,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number | [number, number] }>;
  label?: number;
  nowMs: number;
}) {
  if (!active || !payload || payload.length === 0 || label == null) return null;

  const get = (key: string) =>
    payload.find((p) => p.dataKey === key)?.value as number | undefined;
  const bandValue = payload.find((p) => p.dataKey === "band")?.value as
    | [number, number]
    | undefined;

  const actual = get("actual");
  const predicted = get("predicted");
  const isFuture = label > nowMs;
  const value = isFuture ? predicted : actual;
  if (value == null) return null;

  const aqiBand = getAQIBand(value);

  return (
    <div className="border border-smoke-700 bg-smoke-950 px-3 py-2 shadow-[0_16px_40px_rgba(0,0,0,0.6)]">
      <p className="u-label text-smoke-500">
        {formatISTHourLabel(new Date(label).toISOString())} IST ·{" "}
        {isFuture ? "forecast" : "observed"}
      </p>
      <p className="mt-1 flex items-baseline gap-2">
        <span
          className="u-figure text-row"
          style={{ color: aqiBand.textColor }}
        >
          {Math.round(value)}
        </span>
        <span className="text-micro text-smoke-300">{aqiBand.label}</span>
      </p>
      {isFuture && bandValue ? (
        <p className="mt-1 text-micro text-smoke-500 tnum">
          {Math.round(bandValue[0])}–{Math.round(bandValue[1])} across the trees
        </p>
      ) : null}
    </div>
  );
}
